import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createExcluder, patternMatcher } from './git.js';

/**
 * Toolchain profiles recognised from marker files. Patterns use the same
 * gitignore-like syntax as `excludes`; `{dir}` is replaced by the directory
 * (repository-relative) that holds the marker, so nested projects work.
 */
export const PROFILES = [
  { id: 'esp-idf', label: 'ESP-IDF', test: (f, txt) => f === 'sdkconfig' || f === 'sdkconfig.defaults' || (f === 'CMakeLists.txt' && /\$ENV\{IDF_PATH\}|project\.cmake|idf_component_register/.test(txt())),
    patterns: ['{dir}build/', '{dir}build_*/', '{dir}build-*/', '{dir}managed_components/', '{dir}sdkconfig.old', '{dir}dependencies.lock.bak'] },
  { id: 'platformio', label: 'PlatformIO', test: f => f === 'platformio.ini',
    patterns: ['.pio/', '.pioenvs/', '.piolibdeps/', '.vscode/.browse.c_cpp.db*', '.vscode/c_cpp_properties.json', '.vscode/launch.json', '.vscode/ipch/'] },
  { id: 'arduino', label: 'Arduino', test: f => f.endsWith('.ino'), patterns: ['{dir}build/', '*.bin', '*.eep'] },
  { id: 'keil', label: 'Keil MDK', test: f => /\.uvprojx?$/i.test(f), patterns: [] /* covered by built-in list */ },
  { id: 'iar', label: 'IAR EW', test: f => /\.ewp$/i.test(f), patterns: ['{dir}Debug/', '{dir}Release/', '{dir}settings/', '*.ewt'] },
  { id: 'eclipse-cdt', label: 'STM32CubeIDE / Eclipse CDT', test: f => f === '.cproject', patterns: ['{dir}Debug/', '{dir}Release/', '.metadata/', '*.launch.bak'] },
  { id: 'cmake', label: 'CMake', test: f => f === 'CMakeLists.txt', patterns: ['{dir}build/', '{dir}build_*/', '{dir}build-*/', 'cmake-build-*/', 'CMakeFiles/', 'CMakeCache.txt', 'CMakeUserPresets.json', 'compile_commands.json'] },
  { id: 'zephyr', label: 'Zephyr / west', test: f => f === 'west.yml' || f === 'prj.conf', patterns: ['{dir}build/', 'twister-out*/'] },
  { id: 'vscode', label: 'VS Code', test: (f, _t, dir, kind) => kind === 'dir' && f === '.vscode', patterns: ['.vscode/ipch/', '.vscode/.browse.c_cpp.db*', '.vscode/*.log'] },
  { id: 'visual-studio', label: 'Visual Studio / .NET', test: f => /\.(?:sln|csproj|vcxproj|vbproj|fsproj)$/i.test(f), patterns: ['bin/', 'obj/', '.vs/', 'x64/', 'Debug/', 'Release/', '*.user', '*.suo', '*.ipch', '*.pdb', '*.ilk', '*.aps'] },
  { id: 'qt', label: 'Qt', test: f => /\.pro$/i.test(f) || f === 'CMakeLists.txt.user', patterns: ['build-*/', '*.pro.user*', 'CMakeLists.txt.user*', 'moc_*.cpp', 'ui_*.h', 'qrc_*.cpp'] },
  { id: 'python', label: 'Python', test: f => ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'].includes(f) || /\.pyw?$/i.test(f),
    patterns: ['__pycache__/', '*.pyc', '*.pyo', '*.pyd', '.venv/', 'venv/', '*.egg-info/', '.pytest_cache/', '.mypy_cache/', '.ruff_cache/', '.tox/', 'htmlcov/', '.ipynb_checkpoints/'] },
  // AMD/Xilinx Vivado project: everything except the .xpr and *.srcs (plus your HDL/XDC/Tcl) is regenerated.
  { id: 'vivado', label: 'Vivado', test: f => /\.xpr$/i.test(f),
    patterns: ['*.cache/', '*.gen/', '*.gen.*/', '*.hw/', '*.ip_user_files/', '*.runs/', '*.sim/', '{dir}*.tmp/',
      '.Xil/', '*.jou', '*.backup.log', 'vivado*.str', 'vivado_pid*.zip', 'usage_statistics_webtalk.*', 'webtalk*.jou', 'webtalk*.log', 'xsim.dir/', '*.wdb', 'xvlog.pb', 'xelab.pb', 'xvhdl.pb', '.hbs/'] },
  // Vivado non-project / HDL tree (constraints + Tcl, no .xpr).
  { id: 'vivado-hdl', label: 'Vivado (HDL/Tcl)', test: f => /\.xdc$/i.test(f),
    patterns: ['.Xil/', '*.jou', '*.backup.log', 'vivado*.str', 'usage_statistics_webtalk.*', 'webtalk*', 'xsim.dir/', '*.wdb', 'xvlog.pb', 'xelab.pb', 'xvhdl.pb'] },
  // Vitis Unified IDE (2023.2+) component: keep vitis-comp.json, src/ and config; the BSP, export and build are regenerated.
  { id: 'vitis', label: 'Vitis', test: f => f === 'vitis-comp.json',
    patterns: ['{dir}build/', '{dir}build_*/', '{dir}*/build/', '{dir}*/build_*/', '{dir}_ide/', '{dir}export/', '{dir}logs/', '{dir}resources/', '{dir}hw/sdt/', '{dir}**/bsp/libsrc/', '{dir}**/bsp/include/', '{dir}**/bsp/lib/',
      '{dir}*/*_bsp/', '{dir}compile_commands.json', '{dir}.wsdata/'] },
  // Vitis/SDK workspace folders (IDE state).
  { id: 'vitis-workspace', label: 'Vitis 工作区', test: (f, _t, dir, kind) => kind === 'dir' && ['_ide', '.rigel_lopper', 'RemoteSystemsTempFiles'].includes(f),
    patterns: ['{dir}_ide/', '{dir}.rigel_lopper/', '{dir}.metadata/', '{dir}RemoteSystemsTempFiles/', '{dir}.analytics', '{dir}logs/', '{dir}.Xil/'] },
  // Classic Vitis / SDK platform and application projects.
  { id: 'vitis-classic', label: 'Vitis (Classic) / SDK', test: f => /\.(?:spr|sprj)$/i.test(f) || f === 'system.mss',
    patterns: ['{dir}export/', '{dir}logs/', '{dir}**/libsrc/', '{dir}**/bspinclude/', '{dir}Debug/', '{dir}Release/', '{dir}_ide/', '{dir}.metadata/'] },
  { id: 'node', label: 'Node.js', test: f => f === 'package.json', patterns: ['.turbo/', '.parcel-cache/', '.nuxt/', '.output/', '.svelte-kit/', '*.tsbuildinfo'] },
  { id: 'rust', label: 'Rust', test: f => f === 'Cargo.toml', patterns: ['target/'] },
  { id: 'java', label: 'Java / Gradle / Maven', test: f => ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'].includes(f), patterns: ['target/', '.gradle/', 'out/', '*.class'] },
  { id: 'go', label: 'Go', test: f => f === 'go.mod', patterns: [] },
  { id: 'kicad', label: 'KiCad', test: f => /\.kicad_pro$/i.test(f), patterns: ['*-backups/', '*.kicad_prl', 'fp-info-cache', '*.lck', '_autosave-*'] },
];

const SKIP = /^(?:\.git|node_modules|\.pio|build|dist|target|\.venv|venv|managed_components|Objects|Listings|\.vs|bin|obj|__pycache__|.*\.(?:runs|cache|gen|hw|ip_user_files|sim))$/i;

/**
 * Scan the repository root and up to `depth` levels below for marker files.
 * @returns {{profiles: {id,label,dir}[], patterns: string[]}}
 */
export async function detectProfiles(root, { depth = 4, maxEntries = 20000, files = null } = {}) {
  const found = new Map(); let seen = 0;
  async function walk(dir, level) {
    let entries;
    try { entries = await fs.readdir(path.join(root, dir), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (++seen > maxEntries) return;
      const name = entry.name;
      if (entry.isDirectory()) {
        for (const profile of PROFILES) if (profile.test(name, () => '', dir, 'dir')) record(profile.id, dir);
        if (level < depth && !SKIP.test(name) && !name.startsWith('.')) await walk(`${dir}${name}/`, level + 1);
        continue;
      }
      let content = '';
      if (name === 'CMakeLists.txt') { try { content = (await fs.readFile(path.join(root, dir, name), 'utf8')).slice(0, 20000); } catch { /* unreadable */ } }
      for (const profile of PROFILES) if (profile.test(name, () => content, dir, 'file')) record(profile.id, dir);
    }
  }
  function record(id, dir) {
    const key = `${id}\0${dir}`;
    if (!found.has(key)) found.set(key, { id, dir });
  }
  if (Array.isArray(files)) {
    // Detection from an already scanned file list: no depth limit, only the folders that were chosen.
    const dirsSeen = new Set(); let cmake = 0;
    for (const file of files) {
      const parts = String(file).split('/'), name = parts.pop();
      for (let i = 0; i < parts.length; i++) {
        const key = parts.slice(0, i + 1).join('/');
        if (dirsSeen.has(key)) continue; dirsSeen.add(key);
        const parent = i ? `${parts.slice(0, i).join('/')}/` : '';
        for (const profile of PROFILES) if (profile.test(parts[i], () => '', parent, 'dir')) record(profile.id, parent);
      }
      const dir = parts.length ? `${parts.join('/')}/` : '';
      let content = '';
      if (name === 'CMakeLists.txt' && cmake++ < 300) { try { content = (await fs.readFile(path.join(root, file), 'utf8')).slice(0, 20000); } catch { /* unreadable */ } }
      for (const profile of PROFILES) if (profile.test(name, () => content, dir, 'file')) record(profile.id, dir);
    }
  } else await walk('', 0);
  // Accept shallow markers first. A marker inside a folder an accepted profile already
  // excludes (Vivado *.gen, a Vitis BSP, build/…) or inside the same kind of project is noise.
  const candidates = [...found.values()].sort((a, b) => a.dir.split('/').length - b.dir.split('/').length || a.dir.localeCompare(b.dir));
  const profiles = [], patterns = new Set(), rules = [];
  const builtIn = createExcluder();
  for (const c of candidates) {
    const probe = `${c.dir}__tgai_probe__`;
    if (c.dir && (builtIn(probe) || rules.some(r => r(probe)))) continue;
    const def = PROFILES.find(p => p.id === c.id);
    // Same kind of project further down only matters when its rules are folder-scoped.
    if (!def.patterns.some(p => p.includes('{dir}')) && profiles.some(p => p.id === c.id && c.dir.toLowerCase().startsWith(p.dir.toLowerCase()))) continue;
    profiles.push({ ...c, label: def.label });
    for (const p of def.patterns) {
      const pattern = p.replace('{dir}', c.dir ? `/${c.dir}` : '');
      if (patterns.has(pattern)) continue;
      patterns.add(pattern);
      if (pattern.endsWith('/')) { const m = patternMatcher(pattern); if (m) rules.push(m); }
    }
    if (profiles.length >= 300) break;
  }
  // Classic Vitis/SDK projects carry an Eclipse .cproject too; show them once.
  const shown = profiles.filter(p => !(p.id === 'eclipse-cdt' && profiles.some(q => q.id === 'vitis-classic' && q.dir === p.dir)));
  return { profiles: shown, patterns: [...patterns].sort() };
}
