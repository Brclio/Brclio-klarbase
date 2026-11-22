import assert from 'node:assert/strict';
import test from 'node:test';

import { BRAND_URL, CONTACT_EMAIL, MAINTAINER_URL, PERSONAL_URL, REPO_URL, SITE_URL } from '../src/deployment.js';

test('both languages identify the project contact and preserve the original licence notice', async () => {
  for(const prefix of ['', 'zh/']){
    const { html:contact } = await import(`../src/legal/${prefix}imprint.js`);
    const { html:privacy } = await import(`../src/legal/${prefix}privacy.js`);
    const { html:licences } = await import(`../src/legal/${prefix}licenses.js`);
    const page = contact();
    for(const url of [SITE_URL, BRAND_URL, PERSONAL_URL, MAINTAINER_URL, REPO_URL, REPO_URL + '/issues', REPO_URL + '/security/advisories/new', 'mailto:' + CONTACT_EMAIL]){
      assert.ok(page.includes('href="' + url + '"'), 'Missing project contact link ' + url);
    }
    assert.match(page, /黄家宝/);
    assert.match(page, /AI悦创/);
    assert.ok(privacy().includes('href="mailto:' + CONTACT_EMAIL + '"'));
    assert.doesNotMatch(page, /TanmoyP|klarbase\.dev|VITE_IMPRINT/);
    assert.match(licences(), /Copyright \(c\) 2026 TanmoyP and Klarbase contributors/);
    assert.ok(licences().includes(REPO_URL + '/blob/main/LICENSE'));
    assert.match(licences(), /© 2026 ESTHER不二/);
    assert.ok(licences().includes('href="https://creativecommons.org/licenses/by-nc-sa/4.0/"'));
    assert.ok(licences().includes('href="https://github.com/esthersjw/esther-design-system"'));
  }
});
