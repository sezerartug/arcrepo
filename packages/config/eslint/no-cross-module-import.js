// @ts-check
import path from 'node:path';

// A module's public interface is `modules/<name>/index.*`; anything deeper is private (ARCHITECTURE §3).
const MODULE = /\/src\/modules\/([^/]+)(?:\/(.*))?$/;
const PUBLIC_ENTRY = /^index(\.[cm]?[jt]sx?)?$/;
const PACKAGE = /\/((?:apps|packages)\/[^/]+)(?:\/|$)/;

const toPosix = (/** @type {string} */ p) => p.split(path.sep).join('/');

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow importing another module or package except through its public entry.',
    },
    schema: [],
    messages: {
      crossModule:
        "Import module '{{module}}' only through its public entry 'modules/{{module}}/index'.",
      crossPackage: "Import '{{pkg}}' by its package name, not by a relative path.",
    },
  },
  create(context) {
    const file = toPosix(context.filename);
    const fileModule = MODULE.exec(file)?.[1];
    const filePackage = PACKAGE.exec(file)?.[1];

    /** @param {import('estree').Node | null | undefined} source */
    function check(source) {
      if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
      if (!source.value.startsWith('.')) return;

      const target = toPosix(path.resolve(path.dirname(context.filename), source.value));
      const targetPackage = PACKAGE.exec(target)?.[1];
      if (filePackage && targetPackage && targetPackage !== filePackage) {
        context.report({ node: source, messageId: 'crossPackage', data: { pkg: targetPackage } });
        return;
      }

      const [, targetModule, rest] = MODULE.exec(target) ?? [];
      if (!targetModule || targetModule === fileModule) return;
      if (rest === undefined || PUBLIC_ENTRY.test(rest)) return;
      context.report({ node: source, messageId: 'crossModule', data: { module: targetModule } });
    }

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    };
  },
};
