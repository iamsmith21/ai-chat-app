import { tool } from "ai";
import { z } from "zod";
// import { execSync } from "child_process";
import { spawnSync } from "child_process";
/**
 * TODO: Implement the code analysis tool
 *
 * This tool should:
 * 1. Accept a Python code string as a parameter
 * 2. Execute the code using the system's Python interpreter
 * 3. Return the stdout output (and stderr if there are errors)
 *
 * How it works:
 *   - The LLM generates Python code to analyze data, do calculations, etc.
 *   - This tool executes that code and returns the output
 *   - The LLM then interprets the results for the user
 *
 * Steps to implement:
 *   a. Define the tool parameters schema using Zod:
 *      - code (string, required): The Python code to execute
 *
 *   b. Execute the Python code:
 *      - Use `child_process.execSync` or `child_process.spawn`
 *      - Run: python3 -c "<code>"
 *      - Set a timeout (e.g., 10 seconds) to prevent infinite loops
 *      - Capture both stdout and stderr
 *
 *   c. Return the results:
 *      - stdout: The program's output
 *      - stderr: Any error messages (if applicable)
 *      - exitCode: 0 for success, non-zero for errors
 *
 *   d. Handle errors:
 *      - Timeout exceeded
 *      - Python not installed
 *      - Syntax errors in the code
 *      - Runtime errors
 *
 * Hints:
 *   - Use `execSync` for simplicity, it blocks until the command finishes
 *   - Pass the code via stdin or -c flag to avoid shell escaping issues
 *   - Set `maxBuffer` to handle larger outputs
 *   - Consider using `spawnSync` with `input` option to pipe code via stdin:
 *       spawnSync("python3", ["-c", code], { timeout: 10000, encoding: "utf-8" })
 *
 * Safety notes (mention in INSTRUCTIONS.md):
 *   - This runs arbitrary code on the local machine
 *   - In production, you would sandbox this (Docker, etc.)
 *   - For this assessment, local execution is fine
 */

export const analyzeTool = tool({
  description:
    "Execute Python code for data analysis, calculations, or processing. The LLM writes Python code, and this tool runs it and returns the output.",
  parameters: z.object({
    code: z
      .string()
      .min(1)
      .describe(
        "Complete Python 3 code to execute. Should include all necessary imports and be self-contained."
      ),
    timeout_seconds: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(10)
      .describe("Maximum execution time in seconds (1-30, default 10)"),
  }),

  execute: async ({ code, timeout_seconds }) => {
    if (!code || code.trim().length === 0) {
      return {
        success: false,
        error: "No code provided",
        stdout: "",
        stderr: "",
        exit_code: -1,
      };
    }

    const startTime = Date.now();

    try {
      const result = spawnSync("python3", ["-c", code], {
        input: code,
        timeout: timeout_seconds * 1000,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      });

      const executionTime = Date.now() - startTime;

      if (result.error) {
        const err: any = result.error;

        if (err.code === "ENOENT") {
          return {
            success: false,
            error: "Python 3 is not installed or not found in PATH",
            stdout: result.stdout ?? "",
            stderr: result.stderr ?? "python3 not found",
            exit_code: -1,
            execution_time_ms: executionTime,
            help: "Install Python from https://www.python.org/downloads/",
          };
        }

        if (err.code === "ETIMEDOUT") {
          return {
            success: false,
            error: `Execution timed out after ${timeout_seconds} seconds`,
            stdout: result.stdout ?? "",
            stderr: result.stderr ?? "",
            exit_code: -1,
            execution_time_ms: executionTime,
          };
        }

        return {
          success: false,
          error: "Failed to start or run Python process",
          stdout: result.stdout ?? "",
          stderr: result.stderr ?? (err.message ?? String(err)),
          exit_code: -1,
          execution_time_ms: executionTime,
        };
      }

      const exitCode =
        typeof result.status === "number"
          ? result.status
          : result.signal
          ? -1
          : 0;

      const stdout = result.stdout ?? "";
      const stderr = result.stderr ?? "";

      if (exitCode === 0) {
        return {
          success: true,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
          exit_code: 0,
          execution_time_ms: executionTime,
        };
      }

      return {
        success: false,
        error: "Python execution failed",
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exit_code: exitCode,
        execution_time_ms: executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: "Unexpected error during code execution",
        details: error instanceof Error ? error.message : String(error),
        stdout: "",
        stderr: "",
        exit_code: -1,
        execution_time_ms: executionTime,
      };
    }
  },
});
