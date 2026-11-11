import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {loadTypeScriptModule} from '../helpers/load-typescript-module.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const history=loadTypeScriptModule(path.join(root,'src/features/products/recent-history.ts'),{});
const search=loadTypeScriptModule(path.join(root,'src/features/search/search-helpers.ts'),{});

test('corrupt, expired and duplicate browser visits cannot become displayed history',()=>{
 const now=Date.UTC(2026,10,12);
 assert.deepEqual(history.parseRecentHistory('invalid',now),[]);
 assert.deepEqual(history.parseRecentHistory('{"id":"1"}',now),[]);
 const data=[null,{id:'2',viewedAt:now},{id:'2',viewedAt:now-1},{id:'1',viewedAt:now-31*86400000},{id:'3',viewedAt:now+2*86400000},{id:'invalid',viewedAt:now},{id:'4',viewedAt:now-1}];
 assert.deepEqual(history.parseRecentHistory(JSON.stringify(data),now).map(v=>v.id),['2','4']);
 const many=Array.from({length:20},(_,i)=>({id:String(i+1),viewedAt:now-i}));assert.equal(history.parseRecentHistory(JSON.stringify(many),now).length,12);
 assert.notEqual(history.recentKey('1'),history.recentKey('2'));
});
test('invalid pagination and sort URLs cannot produce negative offsets or invalid native sort fields',()=>{
 for(const value of ['-1','0','1.5','Infinity','10001','no-page'])assert.equal(search.getCurrentPage({page:value}),1);
 assert.equal(search.getCurrentPage({page:['3','4']}),3);
 const result=search.buildSearchInput({searchParams:{page:'-10',sort:'__proto__',q:['  Robot  ','Ignored'],stock:'1'}});
 assert.equal(result.skip,0);assert.equal(result.term,'Robot');assert.equal(result.inStock,true);assert.deepEqual(result.sort,{name:'ASC'});
});
test('multi-value attributes use OR within a facet, AND across facets and stable pagination',()=>{
 const result=search.buildSearchInput({searchParams:{page:'2',sort:'price-desc',facets:['1','2','3','1','invalid'],collection:'robots'},facetGroups:{1:'brand',2:'brand',3:'level'}});
 assert.deepEqual(result.facetValueFilters,[{or:['1','2']},{and:'3'}]);assert.deepEqual(result.sort,{price:'DESC'});assert.equal(result.skip,12);assert.equal(result.collectionSlug,'robots');
 assert.equal(search.buildSearchInput({searchParams:{collection:'other'},collectionSlug:'fixed'}).collectionSlug,'fixed');
});
