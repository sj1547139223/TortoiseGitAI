import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Toolchain profiles recognised from marker files. Patterns use the same
 * gitignore-like syntax as `excludes`; `{dir}` is replaced by the directory
 * (repository-relative) that holds the marker, so nested projects work.
 */
export const PROFILES = [
  { id: 'esp-idf', label: 'ESP-IDF', test: (f, txt) => f === 'sdkconfig' || f === 'sdkconfig.defaults' || (f === 'CMakeLists.txt' && /\$ENV\{IDF_PATH\}|project\.cmake|idf_component_register/.test(txt())),
    patterns: ['{dir}build/', '{dir}managed_components/', '{dir}sdkconfig.old'] },
  { id: 'platformio', label: 'PlatformIO', test: f => f === 'platformio.ini',
    patterns: ['.pio/', '.pioenvs/', '.piolibdeps/', '.vscode/.browse.c_cpp.db*', '.vscode/c_cpp_properties.json', '.vscode/launch.json', '.vscode/ipch/'] },
  { id: 'arduino', label: 'Arduino', test: f => f.endsWith('.ino'), patterns: ['{dir}build/', '*.bin', '*.eep'] },
  { id: 'keil', label: 'Keil MDK', test: f => /\.uvprojx?$/i.test(f), patterns: [] /* covered by built-in list */ },
  { id: 'iar', label: 'IAR EW', test: f => /\.ewp$/i.test(f), patterns: ['{dir}Debug/', '{dir}Release/', '{dir}settings/', '*.ewt'] },
  { id: 'eclipse-cdt', label: 'STM32CubeIDE / Eclipse CDT', test: f => f === '.cproject', patterns: ['{dir}Debug/', '{dir}Release/', '.metadata/', '*.launch.bak'] },
  { id: 'cmake', label: 'CMake', test: f => f === 'CMakeLists.txt', patterns: ['{dir}build/', 'cmake-build-*/', 'CMakeFiles/', 'CMakeCache.txt', 'CMakeUserPresets.json', 'compile_commands.json'] },
  { id: 'zephyr', label: 'Zephyr / west', test: f => f === 'west.yml' || f === 'prj.conf', patterns: ['{dir}build/', 'twister-out*/'] },
  { id: 'vscode', label: 'VS Code', test: (f, _t, dir) => dir === '.vscode/' || f === '.vscode', patterns: ['.vscode/ipch/', '.vscode/.browse.c_cpp.db*', '.vscode/*.log'] },
  { id: 'visual-studio', label: 'Visual Studio / .NET', test: f => /\.(?:sln|csproj|vcxproj|vbproj|fsproj)$/i.test(f), patterns: ['bin/', 'obj/', '.vs/', 'x64/', 'Debug/', 'Release/', '*.user', '*.suo', '*.ipch', '*.pdb', '*.ilk', '*.aps'] },
  { id: 'qt', label: 'Qt', test: f => /\.pro$/i.test(f) || f === 'CMakeLists.txt.user', patterns: ['build-*/', '*.pro.user*', 'CMakeLists.txt.user*', 'moc_*.cpp', 'ui_*.h', 'qrc_*.cpp'] },
  { id: 'python', label: 'Python', test: f => ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'].includes(f), patterns: ['.venv/', 'venv/', '*.egg-info/', '.pytest_cache/', '.mypy_cache/', '.ruff_cache/', '.tox/', 'htmlcov/'] },
  { id: 'node', label: 'Node.js', test: f => f === 'package.json', patterns: ['.turbo/', '.parcel-cache/', '.nuxt/', '.output/', '.svelte-kit/', '*.tsbuildinfo'] },
  { id: 'rust', label: 'Rust', test: f => f === 'Cargo.toml', patterns: ['target/'] },
  { id: 'java', label: 'Java / Gradle / Maven', test: f => ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'].includes(f), patterns: ['target/', '.gradle/', 'out/', '*.class'] },
  { id: 'go', label: 'Go', test: f => f === 'go.mod', patterns: [] },
  { id: 'kicad', label: 'KiCad', test: f => /\.kicad_pro$/i.test(f), patterns: ['*-backups/', '*.kicad_prl', 'fp-info-cache', '*.lck', '_autosave-*'] },
];

const SKIP = /^(?:\.git|node_modules|\.pio|build|dist|target|\.venv|venv|managed_components|Objects|Listings|\.vs|bin|obj)$/i;

/**
 * Scan the repository root and up to `depth` levels below for marker files.
 * @returns {{profiles: {id,label,dir}[], patterns: string[]}}
 */
export async function detectProfiles(root, { depth = 2, maxEntries = 4000 } = {}) {
  const found = new Map(); let seen = 0;
  async function walk(dir, level) {
    let entries;
    try { entries = await fs.readdir(path.join(root, dir), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (++seen > maxEntries) return;
      const name = entry.name;
      if (entry.isDirectory()) {
        if (name === '.vscode') record('vscode', dir);
        if (level < depth && !SKIP.test(name) && !name.startsWith('.')) await walk(`${dir}${name}/`, level + 1);
        continue;
      }
      let content = '';
      if (name === 'CMakeLists.txt') { try { content = (await fs.readFile(path.join(root, dir, name), 'utf8')).slice(0, 20000); } catch { /* unreadable */ } }
      for (const profile of PROFILES) if (profile.test(name, () => content, dir)) record(profile.id, dir);
    }
  }
  function record(id, dir) {
    const key = `${id}\0${dir}`;
    if (!found.has(key)) found.set(key, { id, dir });
  }
  await walk('', 0);
  // ESP-IDF projects are CMake projects too; keep both but IDF first.
  const profiles = [...found.values()].map(f => ({ ...f, label: PROFILES.find(p => p.id === f.id).label }));
  const patterns = new Set();
  for (const f of profiles) for (const p of PROFILES.find(x => x.id === f.id).patterns) patterns.add(p.replace('{dir}', f.dir ? `/${f.dir}` : ''));
  return { profiles, patterns: [...patterns].sort() };
}
