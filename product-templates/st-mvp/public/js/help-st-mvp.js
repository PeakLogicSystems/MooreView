'use strict';

window.ST_MVP_HELP = [
  {
    id: 'start',
    title: 'Getting started',
    html: `
      <p>MooreVIEW <strong>ST MVP</strong> runs on Linux with a built-in web UI for projects, ST programs, tags, drivers, and the PLC scan engine.</p>
      <h4>Quick start</h4>
      <ol>
        <li>On the Linux host: <code>npm install</code> then <code>npm start</code></li>
        <li>Open <code>http://&lt;host&gt;:3090</code> in a browser on the same network.</li>
        <li><strong>Project</strong> — create or open a <code>.est</code> file (tags + drivers + program).</li>
        <li><strong>Drivers</strong> — configure Modbus, MQTT, or simulation; <strong>Apply</strong>.</li>
        <li><strong>Tags</strong> — edit or import/export JSON; match names used in ST.</li>
        <li><strong>Program</strong> — edit ST, <strong>Validate</strong>, <strong>Save</strong>.</li>
        <li><strong>Runtime</strong> — <strong>Start</strong> to run the scan cycle.</li>
      </ol>
      <p>Data directory: <code>data/</code> (or <code>MOOREVIEW_DATA</code>). Programs: <code>st/</code>.</p>
    `,
  },
  {
    id: 'project',
    title: 'Projects',
    html: `
      <p>A <strong>project</strong> bundles tags, drivers, ST source, and settings in a portable <code>.est</code> JSON file.</p>
      <ul>
        <li><strong>New project</strong> — blank tags/drivers and starter program.</li>
        <li><strong>Open .est</strong> — load a file from disk (upload).</li>
        <li><strong>Save .est</strong> — download current workspace as <code>.est</code>.</li>
        <li><strong>Save to library</strong> — store a copy under <code>data/projects/</code> on the device.</li>
        <li><strong>Open from library</strong> — reload a saved project on this host.</li>
      </ul>
      <p>Use <strong>Save workspace</strong> to persist without downloading — writes <code>data/workspace.est.json</code>.</p>
    `,
  },
  {
    id: 'program',
    title: 'ST program',
    html: `
      <p>Edit Structured Text in the <strong>Program</strong> tab. Tag names in ST must exist in the tag table.</p>
      <ul>
        <li><strong>Validate</strong> — syntax and tag reference check without saving.</li>
        <li><strong>Save</strong> — write active program to <code>st/</code>.</li>
        <li><strong>Load file</strong> — pick another <code>.st</code> from the program tree.</li>
        <li><strong>Load + fixtures</strong> — also loads matching <code>st/fixtures/*.json</code> tags/drivers.</li>
      </ul>
      <p>Example samples live under <code>st/logic/</code>, <code>st/modbus/</code>, <code>st/mqtt/</code>.</p>
    `,
  },
  {
    id: 'tags',
    title: 'Tags',
    html: `
      <p>Tags are the I/O and memory map for the runtime. The table shows live values while polling.</p>
      <ul>
        <li><strong>Export tags</strong> — download <code>tags.json</code> for backup or transfer.</li>
        <li><strong>Import tags</strong> — upload JSON array; replaces the tag table on apply.</li>
        <li><strong>Edit JSON</strong> — advanced edit; click <strong>Apply tags</strong> when done.</li>
      </ul>
      <p>Roles: <code>input</code>, <code>output</code>, <code>memory</code>. Types: <code>BOOL</code>, <code>INT</code>, <code>REAL</code>, etc.</p>
      <p><strong>32-bit arrays:</strong> INT tags with <strong>Bits</strong> 32 and <strong>array length</strong> &gt; 1 map to one Modbus holding block (read FC3, write FC16). In ST: <code>HR_BLK[2]</code>, <code>SetArray(HR_BLK, 2, 99);</code>. Preset: <em>Modbus 32-bit array — 8 DINT block</em>.</p>
    `,
  },
  {
    id: 'drivers',
    title: 'Drivers',
    html: `
      <p>Drivers connect tags to field devices (Modbus TCP/RTU, MQTT, HTTPS, simulation).</p>
      <ul>
        <li><strong>Export / Import</strong> — JSON backup of driver list.</li>
        <li><strong>Device preset</strong> — apply a template (tags + drivers) for common hardware.</li>
        <li><strong>Test</strong> — connection check for selected driver JSON (edit row first).</li>
        <li>Serial ports on Linux: <code>/dev/ttyUSB0</code>, <code>/dev/ttyACM0</code> — user must be in <code>dialout</code> group.</li>
        <li><strong>hal</strong> driver — built-in DI/DO/AI/AO and hardware counters. Presets: <strong>Built-in HAL (sim)</strong>; <strong>Raspberry Pi 4 + Sequent SM-I-001</strong> (C plugin <code>hal/plugins/rpi4_sm_i001_hal.c</code>, <code>make sm_i001</code>). Tag pins: <code>DI0</code>, <code>DO0</code>, <code>AI0</code>, <code>CNT0</code> — see <code>docs/HAL.md</code> and <code>hal/plugins/README_SM-I-001.md</code>.</li>
      </ul>
    `,
  },
  {
    id: 'runtime',
    title: 'Runtime',
    html: `
      <p>The scan engine runs your ST program on a fixed interval (<strong>scan ms</strong>).</p>
      <ul>
        <li><strong>Start</strong> — compile ST and begin scanning (drivers must be healthy).</li>
        <li><strong>Pause / Resume</strong> — hold I/O updates without losing state.</li>
        <li><strong>Stop</strong> — end runtime.</li>
      </ul>
      <p>If start fails with <em>Unknown tag</em>, load fixtures or open a complete project so tag names match the program.</p>
      <h4>systemd</h4>
      <p>Install <code>deploy/mooreview-st-mvp.service</code> for boot-time start on embedded Linux.</p>
    `,
  },
];
