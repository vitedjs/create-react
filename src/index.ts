import { pascalCase } from 'change-case';
import glob from 'fast-glob';
import { outputFile, outputJSON, pathExists, readJSON } from 'fs-extra';
import merge from 'merge';
import { getPackageJsonFromGit } from 'package-json-from-git';
import { basename, join } from 'path';
import sortPackageJson from 'sort-package-json';
import changelog from './template/changelog.txt';
import docAppTs from './template/docApp.txt';
import docIndexTs from './template/docIndex.txt';
import editorconfig from './template/editorconfig.txt';
import gitignore from './template/gitignore.txt';
import indexHtml from './template/index.html.txt';
import indexTestTs from './template/index.test.txt';
import indexTs from './template/index.txt';
import packageJsonDefaults from './template/package-defaults.json';
import packageJsonOverrides from './template/package-overrides.json';
import readme from './template/readme.txt';
import vscodeExtensions from './template/vscode-extensions.json';
import vscodeSettings from './template/vscode-settings.json';
import tsconfigJson from './template/_tsconfig.json';

export interface CreateProjectOptions {
  // Initial version number, 1.0.0 by default
  packageVersion?: string;
}

export async function createProject(
  project: string | null,
  { packageVersion }: CreateProjectOptions
) {
  const projectFullPath = project ? join(process.cwd(), project) : process.cwd();

  // .vscode/settings.json
  const vscodeSettingsPath = join(projectFullPath, '.vscode', 'settings.json');
  outputJSON(vscodeSettingsPath, vscodeSettings, { spaces: 2 });

  // .vscode/extensions.json
  const vscodeExtensionsPath = join(projectFullPath, '.vscode', 'extensions.json');
  outputJSON(vscodeExtensionsPath, vscodeExtensions, { spaces: 2 });

  // .editorconfig
  const editorConfigPath = join(projectFullPath, '.editorconfig');
  outputFile(editorConfigPath, editorconfig);

  // .gitignore
  const gitignorePath = join(projectFullPath, '.gitignore');
  outputFile(gitignorePath, gitignore);

  // package.json
  const packageJsonPath = join(projectFullPath, 'package.json');
  let oldPackageJson: any = {};
  if (await pathExists(packageJsonPath)) {
    oldPackageJson = await readJSON(packageJsonPath, { throws: false });
  }
  const newPackageJson: any = await getPackageJsonFromGit();
  merge.recursive(newPackageJson, packageJsonDefaults, oldPackageJson, packageJsonOverrides);
  newPackageJson.name ||= basename(projectFullPath);
  newPackageJson.version = packageVersion || newPackageJson.version || '1.0.0';
  outputJSON(packageJsonPath, sortPackageJson(newPackageJson), { spaces: 2 });

  // tsconfig.json
  const tsconfigJsonPath = join(projectFullPath, 'tsconfig.json');
  // alias to be used in examples
  tsconfigJson.compilerOptions.paths = { [newPackageJson.name]: ['./src'] };
  outputJSON(tsconfigJsonPath, tsconfigJson, { spaces: 2 });

  // CHANGELOG.md
  const changelogPath = join(projectFullPath, 'CHANGELOG.md');
  if (!(await pathExists(changelogPath))) {
    const date = new Date().toISOString().substring(0, 10);
    const newChangelog = changelog
      .replaceAll('%date%', date)
      .replaceAll('%version%', newPackageJson.version);
    outputFile(changelogPath, newChangelog);
  }

  // README.md
  const readmePath = join(projectFullPath, 'README.md');
  if (!(await pathExists(readmePath))) {
    const newReadme = readme.replaceAll('%name%', newPackageJson.name);
    outputFile(readmePath, newReadme);
  }

  // src/index.tsx
  const indexTsPath = join(projectFullPath, 'src', 'index.tsx');
  if (!(await glob(projectFullPath + '/src/index.{js,jsx,ts,tsx}')).length) {
    const componentName = pascalCase(basename(projectFullPath));
    outputFile(indexTsPath, indexTs.replaceAll('%componentName%', componentName));

    // src/index.test.tsx
    const indexTestTsPath = join(projectFullPath, 'src', 'index.test.tsx');
    outputFile(indexTestTsPath, indexTestTs.replaceAll('%componentName%', componentName));
  }

  // index.html
  const indexHtmlPath = join(projectFullPath, 'index.html');
  outputFile(indexHtmlPath, indexHtml.replaceAll('%packageName%', newPackageJson.name));

  // docs/index.tsx
  const docIndexTsPath = join(projectFullPath, 'docs', 'index.tsx');
  if (!(await pathExists(docIndexTsPath))) {
    outputFile(docIndexTsPath, docIndexTs);

    // docs/App.tsx
    const docAppTsPath = join(projectFullPath, 'docs', 'App.tsx');
    outputFile(docAppTsPath, docAppTs);
  }
}
