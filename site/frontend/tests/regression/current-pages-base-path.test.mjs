import test from 'node:test';
import assert from 'node:assert/strict';
import {demoRuntime} from '../helpers/demo-runtime.mjs';
import {localPagesBase} from '../parity/pages-base.mjs';

for (const basePath of ['/Test-3','/efhc','/future-name']) {
  test(`public assets, skins, Shop handoff and Back use configured ${basePath}`, async () => {
    const h=demoRuntime({basePath,pathname:basePath+'/admin/users/'});
    const assets=h.loadSource('lib/publicAssetPath.ts'),skins=h.loadSource('lib/skins.ts'),paths=h.loadSource('lib/appBasePath.ts');
    assert.equal(assets.publicAssetPath('/demo/frozen-admin-1000-v866.json'),basePath+'/demo/frozen-admin-1000-v866.json');
    assert.equal(assets.publicAssetPath(basePath+'/demo/frozen-admin-1000-v866.json'),basePath+'/demo/frozen-admin-1000-v866.json','export rewriting must not add a second deployment prefix');
    assert.equal(skins.getShopSkinBgUrl(9),basePath+'/skins/9.webp');
    const handoff=await h.api('/hub/efhc-handoff','POST',{},'handoff');
    assert.equal(new URL(handoff.redirect_url).pathname,basePath+'/browser-shop/');
    assert.equal(paths.withoutAppBasePath(basePath+basePath+'/admin/?section=one'),'/admin/?section=one');
    assert.equal(paths.withoutAppBasePath('/Test-3/panels/portfolio/'),'/panels/portfolio/');
    assert.equal(paths.withoutAppBasePath(basePath+'-other/panels/'),basePath+'-other/panels/');
  });
}
test('root/production resources keep their previous root paths',()=>{
  for(const options of [{basePath:''},{basePath:'/efhc',preview:false}]){
    const h=demoRuntime(options);assert.equal(h.loadSource('lib/publicAssetPath.ts').publicAssetPath('/icon.png'),'/icon.png');
    assert.equal(h.loadSource('lib/skins.ts').getShopSkinBgUrl(9),'/skins/9.webp');
    assert.equal(h.loadSource('lib/appBasePath.ts').withoutAppBasePath('/panels/'),'/panels/');
  }
});
test('browser verification changes prefix without allowing external test destinations',()=>{
  for(const prefix of ['Test-3','efhc','future-name'])assert.equal(localPagesBase(`http://127.0.0.1:19243/${prefix}/`),`http://127.0.0.1:19243/${prefix}/`);
  for(const url of ['https://example.com/efhc/','http://127.0.0.1:19243/','http://127.0.0.1:19243/efhc/nested/','http://127.0.0.1:19243/efhc/?x=1'])assert.throws(()=>localPagesBase(url));
});
