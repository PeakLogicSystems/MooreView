'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  normalizeHmi,
  defaultDemoHmi,
  listSvgAssets,
  resolveAssetPath,
  HOME_SCREEN_ID,
  reindexHmiScreens,
  HMI_MAX_LAYERS,
  HMI_OBJ_KINDS,
} = require('../src/hmi/hmiConfig');
const { listHmiComposites } = require('../src/hmi/hmiComposites');

describe('hmiConfig', () => {
  it('normalizeHmi preserves valid activeScreen after reindex', () => {
    const hmi = normalizeHmi({
      activeScreen: 's2',
      screens: [
        { id: 's1', name: 'Main', svg: '/hmi/svg/a.svg' },
        { id: 's2', name: 'Alt', svg: '/hmi/svg/b.svg' },
      ],
      bindings: [],
    }, []);
    assert.equal(hmi.activeScreen, 'screen_2');
    assert.equal(hmi.screens[1].id, 'screen_2');
  });

  it('normalizeHmi reindexes screens and falls back to screen_1', () => {
    const tags = [{ id: 'DI1' }, { id: 'Q1' }];
    const hmi = normalizeHmi({
      activeScreen: 'missing',
      screens: [{ id: 's1', name: 'Main', svg: '/hmi/svg/a.svg' }],
      bindings: [
        { screenId: 's1', elementId: 'p1', tagId: 'Q1', property: 'fill' },
        { elementId: 'bad', tagId: 'NOPE', property: 'fill' },
        { elementId: '', tagId: 'DI1', property: 'fill' },
      ],
    }, tags);
    assert.equal(hmi.activeScreen, HOME_SCREEN_ID);
    assert.equal(hmi.screens.length, 1);
    assert.equal(hmi.screens[0].id, HOME_SCREEN_ID);
    assert.equal(hmi.screens[0].number, 1);
    assert.equal(hmi.screens[0].name, 'Main');
    assert.equal(hmi.bindings.length, 1);
    assert.equal(hmi.bindings[0].tagId, 'Q1');
    assert.equal(hmi.bindings[0].screenId, HOME_SCREEN_ID);
  });

  it('reindexHmiScreens assigns numeric ids and remaps bindings', () => {
    const { screens, bindings, activeScreen } = reindexHmiScreens([
      { id: 'demo_process', name: 'Process', svg: '/a.svg' },
      { id: 'custom', name: 'Other', svg: '/b.svg' },
    ], [
      { screenId: 'demo_process', elementId: 'p1', tagId: 'Q1', property: 'fill' },
      { screenId: 'custom', elementId: 'p2', tagId: 'DI1', property: 'fill' },
    ], 'custom');
    assert.equal(activeScreen, 'screen_2');
    assert.equal(screens[0].id, 'screen_1');
    assert.equal(screens[1].id, 'screen_2');
    assert.equal(bindings[0].screenId, 'screen_1');
    assert.equal(bindings[1].screenId, 'screen_2');
  });

  it('reindexHmiScreens supports more than 16 screens', () => {
    const screensIn = Array.from({ length: 20 }, (_, i) => ({
      id: `legacy_${i + 1}`,
      name: `Page ${i + 1}`,
      svg: '/a.svg',
    }));
    const { screens } = reindexHmiScreens(screensIn, [], 'legacy_18');
    assert.equal(screens.length, 20);
    assert.equal(screens[16].id, 'screen_17');
    assert.equal(screens[19].id, 'screen_20');
  });

  it('defaultDemoHmi includes demo screens and DI1/Q1 bindings', () => {
    const hmi = defaultDemoHmi();
    assert.equal(hmi.activeScreen, HOME_SCREEN_ID);
    assert.ok(hmi.screens.some((s) => s.id === 'screen_1' && s.number === 1));
    assert.ok(hmi.screens.some((s) => s.svg.includes('demo_controls.svg')));
    assert.ok(hmi.screens.some((s) => s.svg.includes('demo_process.svg')));
    assert.ok(hmi.bindings.some((b) => b.elementId === 'pilot_di1' && b.tagId === 'DI1'));
    assert.ok(hmi.bindings.some((b) => b.elementId === 'pump1' && b.tagId === 'Q1'));
  });

  it('normalizeHmi accepts backgroundFill binding', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: '@screen',
        tagId: 'DI1',
        property: 'backgroundFill',
        onValue: '#22c55e',
        offValue: '#94a3b8',
      }],
    }, [{ id: 'DI1' }]);
    assert.equal(hmi.bindings.length, 1);
    assert.equal(hmi.bindings[0].property, 'backgroundFill');
    assert.equal(hmi.bindings[0].elementId, '@screen');
  });

  it('normalizeBinding rewrites pilot shape_0 bindings to lamp', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 't4_1_z0__shape_0',
        tagId: 'DI',
        property: 'fill',
      }],
    }, [{ id: 'DI' }]);
    assert.equal(hmi.bindings[0].elementId, 't4_1_z0__lamp');
  });

  it('normalizeTile upgrades pilot light layers to dynamicImage', () => {
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 3,
          row: 0,
          layers: [{
            kind: 'staticImage',
            z: 0,
            svg: '/hmi/svg/library/controls/pilot-lights/standard/mv/pilot-light/pl_round.svg',
          }],
        }],
      }],
      bindings: [],
    }, []);
    assert.equal(hmi.screens[0].tiles[0].layers[0].kind, 'dynamicImage');
  });

  it('normalizeHmi stores state3 HOA switch min/max', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 't2_3__hoa_switch',
        tagId: 'HOA1',
        property: 'state3',
        min: 0,
        max: 100,
      }],
    }, [{ id: 'HOA1' }]);
    assert.equal(hmi.bindings[0].property, 'state3');
    assert.equal(hmi.bindings[0].min, 0);
    assert.equal(hmi.bindings[0].max, 2);
  });

  it('normalizeHmi caps fill5 max at 4 when saved with analog scale', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 't5_6_z0__lamp',
        tagId: 'ST1',
        property: 'fill5',
        min: 0,
        max: 100,
      }],
    }, [{ id: 'ST1' }]);
    assert.equal(hmi.bindings[0].max, 4);
  });

  it('normalizeHmi upgrades legacy fill5 warn yellow to alarm exclamation yellow', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 't5_6_z0__lamp',
        tagId: 'ST1',
        property: 'fill5',
        colors: ['#22c55e', '#ef4444', '#facc15', '#f97316', '#64748b'],
      }],
    }, [{ id: 'ST1' }]);
    assert.equal(hmi.bindings[0].colors[2], '#fbed20');
  });

  it('normalizeHmi upgrades legacy warn-only flash to warn and fault flash', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 't5_6_z0__lamp',
        tagId: 'ST1',
        property: 'fill5',
        flashStates: [2],
      }],
    }, [{ id: 'ST1' }]);
    assert.deepEqual(hmi.bindings[0].flashStates, [2, 3]);
  });

  it('normalizeHmi stores fill5 pilot state palette and flash', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 't1_1_z0__lamp',
        tagId: 'ST1',
        property: 'fill5',
        colors: ['#22c55e', '#ef4444'],
      }],
    }, [{ id: 'ST1' }]);
    assert.equal(hmi.bindings.length, 1);
    assert.equal(hmi.bindings[0].property, 'fill5');
    assert.equal(hmi.bindings[0].colors.length, 5);
    assert.equal(hmi.bindings[0].colors[0], '#22c55e');
    assert.equal(hmi.bindings[0].colors[1], '#ef4444');
    assert.equal(hmi.bindings[0].colors[2], '#fbed20');
    assert.equal(hmi.bindings[0].min, 0);
    assert.equal(hmi.bindings[0].max, 4);
    assert.deepEqual(hmi.bindings[0].flashStates, [2, 3]);
  });

  it('normalizeHmi stores fill8 color palette', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 'tank1',
        tagId: 'AI1',
        property: 'fill8',
        colors: ['#111111', '#222222'],
      }],
    }, [{ id: 'AI1' }]);
    assert.equal(hmi.bindings.length, 1);
    assert.equal(hmi.bindings[0].property, 'fill8');
    assert.equal(hmi.bindings[0].colors.length, 8);
    assert.equal(hmi.bindings[0].colors[0], '#111111');
    assert.equal(hmi.bindings[0].colors[1], '#222222');
    assert.equal(hmi.bindings[0].colors[2], '#eab308');
  });

  it('normalizeHmi stores strip chart pen count on tile layer', () => {
    const stripPath = '/hmi/svg/library/charts-trends/strip-charts/mv/chart-strip/strip_chart.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          layers: [{ kind: 'staticImage', z: 0, svg: stripPath, stripChart: { penCount: 3 } }],
        }],
      }],
      bindings: [],
    }, []);
    assert.equal(hmi.screens[0].tiles.length, 1);
    assert.equal(hmi.screens[0].tiles[0].layers[0].stripChart.penCount, 3);
    assert.equal(hmi.screens[0].tiles[0].layers[0].stripChart.chartScale.min, 0);
    assert.equal(hmi.screens[0].tiles[0].layers[0].stripChart.chartScale.max, 100);
    assert.equal(hmi.screens[0].tiles[0].layers[0].stripChart.chartScale.show, true);
  });

  it('normalizeHmi stores gauge column count and chart scale on tile layer', () => {
    const colPath = '/hmi/svg/library/gauges-meters/column/mv/gauge-column/gauge_column_green.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          layers: [{
            kind: 'dynamicImage',
            z: 0,
            svg: colPath,
            gaugeColumn: { columnCount: 4, chartScale: { min: 10, max: 90, divisions: 4, show: false } },
          }],
        }],
      }],
      bindings: [],
    }, []);
    const layer = hmi.screens[0].tiles[0].layers[0];
    assert.match(layer.svg, /gauge_column\.svg$/);
    assert.equal(layer.gaugeColumn.columnCount, 4);
    assert.equal(layer.gaugeColumn.chartScale.min, 10);
    assert.equal(layer.gaugeColumn.chartScale.max, 90);
    assert.equal(layer.gaugeColumn.chartScale.divisions, 4);
    assert.equal(layer.gaugeColumn.chartScale.show, false);
  });

  it('normalizeChartScale applies defaults for invalid values', () => {
    const { normalizeChartScale } = require('../src/hmi/hmiConfig');
    const scale = normalizeChartScale({ min: 'x', max: null, divisions: 99 });
    assert.equal(scale.min, 0);
    assert.equal(scale.max, 100);
    assert.equal(scale.divisions, 20);
    assert.equal(scale.labelColor, '#64748b');
  });

  it('normalizeHmi infers push button mode from asset path subgroup', () => {
    const momentPath = '/hmi/svg/library/controls/push-buttons/momentary/mv/pb-momentary/pb_moment_square_green.svg';
    const togglePath = '/hmi/svg/library/controls/push-buttons/toggle/mv/pb-toggle1/pb_toggle1_square_green.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [
          { col: 0, row: 0, layers: [{ kind: 'dynamicImage', z: 0, svg: momentPath }] },
          { col: 1, row: 0, layers: [{ kind: 'dynamicImage', z: 0, svg: togglePath }] },
        ],
      }],
      bindings: [],
    }, []);
    assert.equal(hmi.screens[0].tiles[0].layers[0].pushButton.mode, 'momentary');
    assert.equal(hmi.screens[0].tiles[1].layers[0].pushButton.mode, 'latched');
  });

  it('normalizeHmi keeps explicit push button mode on tile layer', () => {
    const path = '/hmi/svg/library/controls/push-buttons/momentary/mv/pb-momentary/pb_moment_square_green.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          layers: [{ kind: 'dynamicImage', z: 0, svg: path, pushButton: { mode: 'latched' } }],
        }],
      }],
      bindings: [],
    }, []);
    assert.equal(hmi.screens[0].tiles[0].layers[0].pushButton.mode, 'latched');
  });

  it('pushButtonInteractionForMode maps mode to binding interaction', () => {
    const { pushButtonInteractionForMode } = require('../src/hmi/hmiConfig');
    assert.equal(pushButtonInteractionForMode('momentary'), 'pulse');
    assert.equal(pushButtonInteractionForMode('latched'), 'toggle');
  });

  it('normalizeHmi migrates legacy colored push button to canonical asset', () => {
    const legacy = '/hmi/svg/library/controls/push-buttons/momentary/mv/pb-momentary/pb_moment_oblong_red.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          layers: [{ kind: 'dynamicImage', z: 0, svg: legacy }],
        }],
      }],
      bindings: [],
    }, []);
    const layer = hmi.screens[0].tiles[0].layers[0];
    assert.match(layer.svg, /pb-canonical\/push_button_oblong\.svg$/);
    assert.equal(layer.pushButton.shape, 'oblong');
    assert.equal(layer.pushButton.colors.background, '#ef4444');
    assert.equal(layer.pushButton.mode, 'momentary');
  });

  it('normalizeHmi keeps explicit push button shape and colors', () => {
    const path = '/hmi/svg/library/controls/push-buttons/mv/pb-canonical/push_button_square.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          layers: [{
            kind: 'dynamicImage',
            z: 0,
            svg: path,
            pushButton: {
              mode: 'latched',
              shape: 'round',
              colors: { background: '#2563eb', text: '#ffffff', bezel: '#334155' },
            },
          }],
        }],
      }],
      bindings: [],
    }, []);
    const pb = hmi.screens[0].tiles[0].layers[0].pushButton;
    assert.equal(pb.mode, 'latched');
    assert.equal(pb.shape, 'round');
    assert.equal(pb.colors.background, '#2563eb');
    assert.equal(pb.colors.text, '#ffffff');
    assert.equal(pb.colors.bezel, '#334155');
    assert.match(hmi.screens[0].tiles[0].layers[0].svg, /push_button_round\.svg$/);
  });

  it('normalizeHmi infers pilot light kind from asset path', () => {
    const simplePath = '/hmi/svg/library/controls/pilot-lights/standard/mv/pilot-light/pl_round.svg';
    const complexPath = '/hmi/svg/library/controls/pilot-lights/multicolor/mv/pilot-light-multi-colour/pl_multi_square.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [
          { col: 0, row: 0, layers: [{ kind: 'dynamicImage', z: 0, svg: simplePath }] },
          { col: 1, row: 0, layers: [{ kind: 'dynamicImage', z: 0, svg: complexPath }] },
        ],
      }],
      bindings: [],
    }, []);
    assert.equal(hmi.screens[0].tiles[0].layers[0].pilotLight.kind, 'simple');
    assert.equal(hmi.screens[0].tiles[1].layers[0].pilotLight.kind, 'complex');
  });

  it('normalizeHmi migrates legacy pilot light to canonical asset', () => {
    const legacy = '/hmi/svg/library/controls/pilot-lights/standard/mv/pilot-light/pl_square.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          layers: [{ kind: 'dynamicImage', z: 0, svg: legacy }],
        }],
      }],
      bindings: [],
    }, []);
    const layer = hmi.screens[0].tiles[0].layers[0];
    assert.match(layer.svg, /pl-canonical\/pilot_light_square\.svg$/);
    assert.equal(layer.pilotLight.shape, 'square');
    assert.equal(layer.pilotLight.kind, 'simple');
    assert.equal(layer.pilotLight.colors.off, '#22c55e');
    assert.equal(layer.pilotLight.colors.on, '#ef4444');
  });

  it('normalizeHmi keeps explicit pilot light shape and colors', () => {
    const path = '/hmi/svg/library/controls/pilot-lights/mv/pl-canonical/pilot_light_round.svg';
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          layers: [{
            kind: 'dynamicImage',
            z: 0,
            svg: path,
            pilotLight: {
              kind: 'complex',
              shape: 'octagonal',
              colors: ['#111111', '#222222', '#333333', '#444444', '#555555'],
            },
          }],
        }],
      }],
      bindings: [],
    }, []);
    const pl = hmi.screens[0].tiles[0].layers[0].pilotLight;
    assert.equal(pl.kind, 'complex');
    assert.equal(pl.shape, 'octagonal');
    assert.deepEqual(pl.colors, ['#111111', '#222222', '#333333', '#444444', '#555555']);
    assert.match(hmi.screens[0].tiles[0].layers[0].svg, /pilot_light_octagonal\.svg$/);
  });

  it('pilotLightBindingPropertyForKind maps kind to binding property', () => {
    const { pilotLightBindingPropertyForKind } = require('../src/hmi/hmiConfig');
    assert.equal(pilotLightBindingPropertyForKind('simple'), 'fill');
    assert.equal(pilotLightBindingPropertyForKind('complex'), 'fill5');
  });

  it('inferPushButtonShapeFromPath reads shape from legacy filename', () => {
    const {
      inferPushButtonShapeFromPath,
      inferPushButtonColorsFromPath,
      canonicalPushButtonPath,
    } = require('../src/hmi/hmiConfig');
    const p = '/hmi/svg/library/controls/push-buttons/toggle/mv/pb-toggle1/pb_toggle1_rectangular_blue.svg';
    assert.equal(inferPushButtonShapeFromPath(p), 'rectangle');
    assert.equal(inferPushButtonColorsFromPath(p).background, '#2563eb');
    assert.equal(canonicalPushButtonPath('rectangle'), '/hmi/svg/library/controls/push-buttons/mv/pb-canonical/push_button_rectangle.svg');
  });

  it('normalizeHmi stores trend useTagScale on bindings', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 't1_1_z0__trend_pen1',
        tagId: 'VPR1',
        property: 'trend',
        useTagScale: true,
        samples: 64,
      }],
    }, [{ id: 'VPR1', type: 'REAL' }]);
    assert.equal(hmi.bindings[0].useTagScale, true);
  });

  it('normalizeHmi stores PID faceplate tagField on bindings', () => {
    const hmi = normalizeHmi({
      screens: [{ id: 's1', svg: '/hmi/svg/demos/demo_process.svg' }],
      bindings: [{
        screenId: 's1',
        elementId: 't3_4_z0__pv_value',
        tagId: 'PID1',
        property: 'text',
        tagField: 'pv',
        format: 'fixed2',
      }],
    }, [{ id: 'PID1', type: 'PID' }]);
    assert.equal(hmi.bindings.length, 1);
    assert.equal(hmi.bindings[0].tagField, 'pv');
    assert.equal(hmi.bindings[0].tagId, 'PID1');
  });

  it('listSvgAssets finds demo and MV library symbols', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const assets = listSvgAssets(publicRoot);
    assert.ok(assets.some((a) => a.path.includes('demos/demo_process.svg')));
    assert.ok(assets.some((a) => a.path.includes('library/controls/pilot-lights')));
    assert.ok(assets.some((a) => a.path.includes('library/pid-faceplates/mooreview/pid_loop_standard.svg')));
  });

  it('normalizeHmi keeps PID faceplate tile layers as staticImage', () => {
    const hmi = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        gridCols: 12,
        gridRows: 12,
        tiles: [{
          col: 3,
          row: 4,
          colSpan: 5,
          rowSpan: 5,
          label: 'PMP-100',
          layers: [{
            kind: 'staticText',
            z: 0,
            svg: '/hmi/svg/library/pid-faceplates/mooreview/pid_loop_standard.svg',
            label: 'PMP-100',
          }],
        }],
      }],
      bindings: [{
        screenId: 's1',
        elementId: 't4_5_z0__hmi_label',
        tagId: 'PID1',
        property: 'text',
        tagField: 'label',
      }],
    }, [{ id: 'PID1', type: 'PID' }]);
    const tile = hmi.screens[0].tiles[0];
    assert.equal(tile.layers[0].kind, 'staticImage');
    assert.equal(tile.compositeId, 'pid_loop_standard');
    assert.equal(hmi.bindings[0].elementId, 't4_5_z0__loop_label');
  });

  it('normalizeHmi preserves motor_hoa compositeId on faceplate tile', () => {
    const hmi = normalizeHmi({
      activeScreen: 's1',
      screens: [{
        id: 's1',
        name: 'Motor',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 1,
          row: 1,
          layers: [{
            kind: 'staticImage',
            z: 0,
            svg: '/hmi/svg/library/motor-faceplates/mooreview/motor_hoa.svg',
          }],
        }],
      }],
      bindings: [],
    }, []);
    const tile = hmi.screens[0].tiles[0];
    assert.equal(tile.layers[0].kind, 'staticImage');
    assert.equal(tile.compositeId, 'motor_hoa');
  });

  it('normalizeHmi repairs tpo_daily faceplate saved as staticText', () => {
    const hmi = normalizeHmi({
      activeScreen: 's1',
      screens: [{
        id: 's1',
        name: 'TPO',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          colSpan: 4,
          rowSpan: 4,
          compositeId: 'tpo_daily',
          label: 'TPO-1 DAILY CYCLE',
          layers: [{
            kind: 'staticText',
            z: 0,
            svg: '/hmi/svg/library/schedules/mooreview/tpo_daily.svg',
            label: 'TPO-1 DAILY CYCLE',
          }],
        }],
      }],
      bindings: [],
    }, []);
    const tile = hmi.screens[0].tiles[0];
    assert.equal(tile.layers[0].kind, 'staticImage');
    assert.equal(tile.compositeId, 'tpo_daily');
    assert.equal(tile.layers[0].label, undefined);
  });

  it('normalizeHmi repairs tpo_daily bindings from composite manifest', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const hmi = normalizeHmi({
      activeScreen: 's1',
      screens: [{
        id: 's1',
        name: 'TPO',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          colSpan: 4,
          rowSpan: 4,
          compositeId: 'tpo_daily',
          layers: [{
            kind: 'staticImage',
            z: 0,
            svg: '/hmi/svg/library/schedules/mooreview/tpo_daily.svg',
          }],
        }],
      }],
      bindings: [
        {
          screenId: 's1',
          elementId: 't1_1_z0__status_lamp',
          tagId: 'TPO1_EN',
          property: 'fill',
        },
        {
          screenId: 's1',
          elementId: 't1_1_z0__window_start',
          tagId: 'TPO1_START',
          property: 'text',
          format: '',
        },
      ],
    }, [], publicRoot);
    const start = hmi.bindings.find((b) => b.elementId === 't1_1_z0__window_start');
    assert.equal(start?.format, 'hhmm');
    assert.equal(start?.interaction, 'edit');
    assert.equal(start?.tagId, 'TPO1_START');
    assert.ok(!hmi.bindings.some((b) => b.elementId === 't1_1_z0__status_lamp' && b.property === 'fill5'));
    const status = hmi.bindings.find((b) => b.elementId === 't1_1_z0__status_lamp' && b.property === 'fill');
    assert.equal(status?.tagId, 'TPO1_OUT');
    assert.equal(status?.onValue, '#22c55e');
    assert.equal(status?.offValue, '#ef4444');
  });

  it('normalizeHmi preserves custom composite fill colors on repair', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const hmi = normalizeHmi({
      activeScreen: 's1',
      screens: [{
        id: 's1',
        name: 'Motor',
        tiles: [{
          col: 0,
          row: 4,
          colSpan: 4,
          rowSpan: 4,
          compositeId: 'motor_hoa',
          layers: [{
            kind: 'staticImage',
            z: 0,
            svg: '/hmi/svg/library/motor-faceplates/mooreview/motor_hoa.svg',
          }],
        }],
      }],
      bindings: [{
        screenId: 's1',
        elementId: 't1_1_z0__btn_offline',
        tagId: 'MOTOR1_OFFLINE',
        property: 'fill',
        onValue: '#111111',
        offValue: '#222222',
        interaction: 'toggle',
      }],
    }, [], publicRoot);
    const offline = hmi.bindings.find((b) => b.elementId === 't1_1_z0__btn_offline' && b.property === 'fill');
    assert.equal(offline?.onValue, '#111111');
    assert.equal(offline?.offValue, '#222222');
  });

  it('listHmiComposites includes motor_hoa fill5 colors', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const composites = listHmiComposites(publicRoot);
    const motor = composites.find((c) => c.composite?.id === 'motor_hoa');
    assert.ok(motor, 'motor_hoa composite');
    const status = motor.composite.defaultBindings.find((b) => b.elementId === 'status_lamp');
    assert.equal(status?.property, 'fill5');
    assert.ok(Array.isArray(status?.colors) && status.colors.length >= 5);
    const hrs = motor.composite.defaultBindings.find((b) => b.elementId === 'run_hrs');
    assert.equal(hrs?.property, 'text');
    assert.equal(hrs?.format, 'fixed1');
    const starts = motor.composite.defaultBindings.find((b) => b.elementId === 'starts_count');
    assert.equal(starts?.property, 'text');
    assert.equal(starts?.format, 'int');
  });

  it('listHmiComposites includes tpo_daily composite', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const composites = listHmiComposites(publicRoot);
    const tpo = composites.find((c) => c.composite?.id === 'tpo_daily');
    assert.ok(tpo, 'tpo_daily composite');
    const enable = tpo.composite.defaultBindings.find((b) => b.elementId === 'btn_enable');
    assert.equal(enable?.interaction, 'toggle');
    const tod = tpo.composite.defaultBindings.find((b) => b.elementId === 'tod_value');
    assert.equal(tod?.format, 'hhmm');
    const winStart = tpo.composite.defaultBindings.find((b) => b.elementId === 'window_start');
    assert.equal(winStart?.interaction, 'edit');
    assert.equal(winStart?.format, 'hhmm');
    const onMin = tpo.composite.defaultBindings.find((b) => b.elementId === 'param_app_min');
    assert.equal(onMin?.interaction, 'edit');
    assert.equal(onMin?.format, 'int');
    const allDay = tpo.composite.defaultBindings.find((b) => b.elementId === 'chk_24hr');
    assert.equal(allDay?.interaction, 'toggle');
    assert.equal(allDay?.tagRole, 'allDay');
    const offlineBtn = tpo.composite.defaultBindings.find((b) => b.elementId === 'btn_offline');
    assert.equal(offlineBtn?.interaction, 'toggle');
    assert.equal(offlineBtn?.tagRole, 'offline');
    const offlineLabel = tpo.composite.defaultBindings.find((b) => b.elementId === 'btn_offline_label');
    assert.equal(offlineLabel?.onValue, 'OFFLINE');
    assert.equal(offlineLabel?.offValue, 'ONLINE');
  });

  it('listHmiComposites includes PID loop faceplate manifest', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const composites = listHmiComposites(publicRoot);
    const pid = composites.find((c) => c.id === 'pid_loop_standard' || c.path === '@composite/pid_loop_standard');
    assert.ok(pid, 'pid_loop_standard composite');
    assert.ok(pid.composite?.defaultBindings?.some((b) => b.tagField === 'pv'));
    assert.ok(pid.composite?.defaultBindings?.some((b) => b.tagField === 'label' && b.elementId === 'loop_label'));
    assert.ok(pid.composite?.defaultBindings?.some((b) => b.elementId === 'mode_auto' && b.tagField === 'auto'));
    assert.ok(pid.composite?.defaultBindings?.some((b) => b.elementId === 'alarm_hi' && b.tagField === 'alarmHi'));
  });

  it('listSvgAssets exposes only three canonical pilot lights', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const assets = listSvgAssets(publicRoot);
    const pilots = assets.filter((a) => a.group === 'Controls — Pilot lights');
    assert.equal(pilots.length, 3);
    const names = pilots.map((a) => a.name).sort();
    assert.deepEqual(names, [
      'pilot_light_octagonal.svg',
      'pilot_light_round.svg',
      'pilot_light_square.svg',
    ]);
    assert.ok(pilots.every((a) => a.subgroup === 'canonical'));
    assert.ok(pilots.every((a) => !a.path.includes('/animated/')));
    assert.ok(pilots.every((a) => !a.path.includes('/labelled/')));
    assert.ok(pilots.every((a) => !a.path.includes('/system-')));
  });

  it('normalizeHmi migrates legacy demo svg paths', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const hmi = normalizeHmi({
      activeScreen: 'demo_process',
      screens: [{ id: 'demo_process', svg: '/hmi/svg/demo_process.svg' }],
      bindings: [],
    }, [], publicRoot);
    assert.equal(hmi.screens[0].id, HOME_SCREEN_ID);
    assert.equal(hmi.screens[0].svg, '/hmi/svg/demos/demo_process.svg');
  });

  it('resolveAssetPath finds moved demo files', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const resolved = resolveAssetPath(publicRoot, '/hmi/svg/demo_process.svg');
    assert.equal(resolved, '/hmi/svg/demos/demo_process.svg');
  });

  it('resolveAssetPath rewrites legacy opto22/mblogic paths to mv', () => {
    const publicRoot = path.join(__dirname, '..', 'public');
    const legacy = resolveAssetPath(
      publicRoot,
      '/hmi/svg/library/controls/pilot-lights/standard/mblogic/pilot-light/pl_round.svg',
    );
    assert.equal(legacy, '/hmi/svg/library/controls/pilot-lights/standard/mv/pilot-light/pl_round.svg');
  });

  it('normalizeTile migrates legacy svg to layers and stacks z', () => {
    const legacy = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{ col: 1, row: 2, svg: '/hmi/svg/a.svg', label: 'Cap' }],
      }],
      bindings: [],
    }, []).screens[0].tiles[0];
    assert.equal(legacy.layers.length, 1);
    assert.equal(legacy.layers[0].kind, 'staticText');
    assert.equal(legacy.layers[0].z, 0);
    assert.equal(legacy.label, 'Cap');

    const stacked = normalizeHmi({
      screens: [{
        id: 's1',
        svg: '/hmi/svg/demos/demo_process.svg',
        tiles: [{
          col: 0,
          row: 0,
          layers: [
            { kind: 'staticImage', z: 0, svg: '/hmi/svg/base.svg' },
            { kind: 'dynamicImage', z: 4, svg: '/hmi/svg/run.svg', tagId: 'Q1' },
          ],
        }],
      }],
      bindings: [],
    }, []).screens[0].tiles[0];
    assert.equal(stacked.layers.length, 2);
    assert.equal(stacked.layers[1].z, 4);
    assert.equal(HMI_MAX_LAYERS, 5);
    assert.ok(HMI_OBJ_KINDS.includes('dynamicImage'));
  });

  it('normalizeHmi stores project-wide layout and applies to all screens', () => {
    const hmi = normalizeHmi({
      activeScreen: 'screen_1',
      layout: {
        gridCols: 10,
        gridRows: 6,
        cellWidth: 100,
        cellHeight: 80,
        displayMaxWidth: 1200,
        displayMaxHeight: 600,
        fit: 'stretch',
        showGridChrome: false,
        showLiveStatus: false,
      },
      screens: [
        {
          id: 'screen_1',
          name: 'Home',
          svg: '/hmi/svg/demos/demo_process.svg',
          width: 800,
          height: 600,
          gridCols: 8,
          gridRows: 8,
          tiles: [],
        },
        {
          id: 'screen_2',
          name: 'Page 2',
          svg: '/hmi/svg/demos/demo_controls.svg',
          width: 1024,
          height: 800,
          gridCols: 12,
          gridRows: 10,
          tiles: [],
        },
      ],
      bindings: [],
    }, []);
    assert.equal(hmi.layout.gridCols, 10);
    assert.equal(hmi.layout.gridRows, 6);
    assert.equal(hmi.layout.showGridChrome, false);
    assert.equal(hmi.layout.showLiveStatus, false);
    assert.equal(hmi.layout.fit, 'stretch');
    assert.equal(hmi.screens[0].gridCols, 10);
    assert.equal(hmi.screens[1].gridCols, 10);
    assert.equal(hmi.screens[0].width, 1000);
    assert.equal(hmi.screens[1].height, 480);
  });

  it('normalizeHmi keeps inheritProjectLayout screens off global layout and tiles', () => {
    const hmi = normalizeHmi({
      activeScreen: 'screen_1',
      layout: {
        gridCols: 16,
        gridRows: 12,
        cellWidth: 64,
        cellHeight: 64,
        width: 1024,
        height: 768,
        displayMaxWidth: 1024,
        displayMaxHeight: 768,
        fit: 'contain',
      },
      screens: [
        {
          id: 'screen_1',
          number: 1,
          name: 'Plant',
          tiles: [],
          gridCols: 16,
          gridRows: 12,
        },
        {
          id: 'screen_ls_yelvington-triplex',
          number: 7,
          name: 'Yelvington',
          inheritProjectLayout: false,
          facility3dUrl: '/samples/putnam-county-fleet-3d.html',
          gridCols: 16,
          gridRows: 13,
          width: 1385,
          height: 620,
          background: '#1a1a1a',
          tiles: [{
            col: 0,
            row: 0,
            colSpan: 16,
            rowSpan: 13,
            compositeId: 'triplexls',
            compositeTagPrefix: 'YELV',
            layers: [{
              kind: 'staticImage',
              z: 0,
              svg: '/hmi/svg/library/lift-station-faceplates/mooreview/triplexls.svg',
            }],
          }],
        },
      ],
      bindings: [],
    }, [], path.join(__dirname, '..', 'public'));
    const lift = hmi.screens.find((s) => s.id === 'screen_2');
    assert.ok(lift);
    assert.equal(lift.inheritProjectLayout, false);
    assert.equal(lift.gridRows, 13);
    assert.equal(lift.width, 1385);
    assert.equal(lift.height, 620);
    assert.equal(lift.tiles.length, 1);
    assert.equal(lift.tiles[0].rowSpan, 13);
    assert.equal(lift.tiles[0].compositeTagPrefix, 'YELV');
    assert.match(lift.facility3dUrl || '', /putnam-county-fleet-3d/);
    assert.equal(hmi.screens[0].gridRows, 12);
  });

  it('normalizeHmi pins layout facility3dUrl onto home when screen has no tiles', () => {
    const hmi = normalizeHmi({
      activeScreen: 'screen_1',
      layout: {
        composerMode: 'grid',
        facility3dUrl: '/samples/mle-wastewater-ortho-3d.html',
        gridCols: 16,
        gridRows: 12,
      },
      screens: [
        {
          id: 'screen_1',
          number: 1,
          name: 'Plant Overview',
          tiles: [],
        },
        {
          id: 'screen_fleet_3d',
          number: 6,
          name: 'Fleet',
          inheritProjectLayout: false,
          facility3dUrl: '/samples/putnam-county-fleet-3d.html',
          tiles: [],
        },
      ],
      bindings: [],
    }, [], path.join(__dirname, '..', 'public'));
    const home = hmi.screens.find((s) => s.number === 1);
    const fleet = hmi.screens.find((s) => /putnam-county-fleet-3d/.test(s.facility3dUrl || ''));
    assert.match(home?.facility3dUrl || '', /mle-wastewater/);
    assert.match(fleet?.facility3dUrl || '', /putnam-county-fleet-3d/);
  });

  it('normalizeScreen preserves layout fields and tiles', () => {
    const hmi = normalizeHmi({
      activeScreen: 's1',
      screens: [{
        id: 's1',
        svg: '/a.svg',
        width: 1024,
        height: 768,
        fit: 'cover',
        scale: 150,
        background: '#112233',
        tiles: [
          { col: 0, row: 0, svg: '/hmi/svg/demos/demo_controls.svg' },
          { col: 9, row: 0, svg: '/bad.svg' },
          { col: 1, row: 1, svg: '' },
        ],
      }],
      bindings: [],
    }, [], path.join(__dirname, '..', 'public'));
    assert.equal(hmi.screens[0].id, HOME_SCREEN_ID);
    assert.equal(hmi.screens[0].fit, 'cover');
    assert.equal(hmi.screens[0].scale, 150);
    assert.equal(hmi.screens[0].background, '#112233');
    assert.equal(hmi.screens[0].tiles.length, 1);
    assert.equal(hmi.screens[0].tiles[0].col, 0);
    assert.equal(hmi.screens[0].tiles[0].row, 0);
    assert.ok(hmi.screens[0].tiles[0].svg.includes('demo_controls.svg'));
  });
});
