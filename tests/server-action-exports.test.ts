import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import ts from "typescript";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return Boolean(ts.getModifiers(node as ts.HasModifiers)?.some((modifier) => modifier.kind === kind));
}

test('"use server" modules export only async functions and types', () => {
  const violations: string[] = [];

  for (const file of sourceFiles("src")) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const firstStatement = source.statements[0];
    const isServerActionModule =
      firstStatement &&
      ts.isExpressionStatement(firstStatement) &&
      ts.isStringLiteral(firstStatement.expression) &&
      firstStatement.expression.text === "use server";

    if (!isServerActionModule) continue;

    for (const statement of source.statements) {
      if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;

      const allowed =
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        (ts.isFunctionDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.AsyncKeyword));

      if (!allowed) {
        const line = source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1;
        violations.push(`${relative(process.cwd(), file)}:${line}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Server Action modules contain non-function runtime exports:\n${violations.join("\n")}`,
  );
});
