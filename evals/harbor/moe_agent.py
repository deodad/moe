import asyncio
import json
import os
import tempfile
from pathlib import Path

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


class MoeAgent(BaseAgent):
    """Runs one isolated Moe conversation and uploads its transcript and state."""

    @staticmethod
    def name() -> str:
        return "moe"

    def version(self) -> str:
        return "0.1.0"

    async def setup(self, environment: BaseEnvironment) -> None:
        await environment.exec("mkdir -p /app /logs/artifacts")

    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory(prefix="moe-harbor-") as temp_dir:
            result_path = Path(temp_dir) / "eval-result.json"
            process = await asyncio.create_subprocess_exec(
                "npm",
                "exec",
                "--",
                "tsx",
                "evals/harbor/run-case.mts",
                "--model",
                self.model_name or "gpt-5.6-luna",
                "--output",
                str(result_path),
                cwd=repo_root,
                env=os.environ.copy(),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate(instruction.encode())
            (self.logs_dir / "runner-stdout.txt").write_bytes(stdout)
            (self.logs_dir / "runner-stderr.txt").write_bytes(stderr)

            if process.returncode != 0:
                raise RuntimeError(
                    f"Moe eval runner failed with exit code {process.returncode}; see agent logs"
                )
            if not result_path.exists():
                raise RuntimeError("Moe eval runner did not produce eval-result.json")

            result = json.loads(result_path.read_text())
            usage = result.get("usage", {})
            context.n_input_tokens = usage.get("input_tokens")
            context.n_cache_tokens = usage.get("cached_input_tokens")
            context.n_output_tokens = usage.get("output_tokens")
            context.metadata = {"case": result.get("case")}
            await environment.upload_file(result_path, "/app/eval-result.json")
            await environment.upload_file(result_path, "/logs/artifacts/eval-result.json")
