#!/usr/bin/env node
'use strict';
process.argv.push('--double');
const { main } = require('../hvac-split/generate-est.js');
main();
