const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const store = require('../src/store');

test('list() skips non-project files in data/, like pricing settings', () => {
  const file = path.join(__dirname, '..', 'data', `zz-test-settings-${process.pid}.json`);
  fs.writeFileSync(file, JSON.stringify({ currency: 'NPR', hourlyRate: 1500 }));
  try {
    const projects = store.list();
    assert.ok(projects.every((p) => p.id && p.createdAt));
    assert.equal(store.get(`zz-test-settings-${process.pid}`), null);
  } finally {
    fs.unlinkSync(file);
  }
});
