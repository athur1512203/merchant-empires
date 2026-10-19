import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProfitProgress,profitProgress} from './ProfitProgress';
import {GoodsRecipeDetails} from './GoodsRecipe';
import {createCompany} from '../rules/gameState';
import {RECIPES} from '../rules/economyConfig';
import {PRODUCTS} from '../rules/types';
import {vi} from '../i18n/vi';

describe('company profit presentation',()=>{
 it('supports loss, partial progress and an exceeded goal',()=>{
  expect(profitProgress(-200,1000)).toEqual({percent:0,remaining:1200});
  expect(profitProgress(250,1000)).toEqual({percent:25,remaining:750});
  expect(profitProgress(1200,1000)).toEqual({percent:100,remaining:0});
 });
 it.each([null,0,-1,NaN,Infinity])('does not render an invalid goal %s',target=>{
  expect(profitProgress(100,target)).toBeNull();
  expect(renderToStaticMarkup(createElement(ProfitProgress,{profit:100,target}))).not.toContain('role="progressbar"');
 });
 it('renders the authoritative cumulative profit and completed victory',()=>{
  const player={...createCompany(0),cash:9999,profit:250};
  const html=renderToStaticMarkup(createElement(ProfitProgress,{profit:player.profit,target:1000}));
  expect(html).toContain('aria-valuenow="25"');expect(html).not.toContain('9999');
  expect(renderToStaticMarkup(createElement(ProfitProgress,{profit:1000,target:1000,won:true}))).toContain('Đã chiến thắng');
 });
});
describe('production recipe presentation',()=>{
 it.each(PRODUCTS)('reads %s directly from the current production rules',product=>{
  const player=createCompany(0),recipe=RECIPES[product];
  const html=renderToStaticMarkup(createElement(GoodsRecipeDetails,{product,player}));
  for(const [input,amount] of Object.entries(recipe.inputs)){
   expect(html).toContain(vi.commodities[input as keyof typeof vi.commodities]);
   expect(html).toContain(`<td>${amount}</td>`);
  }
  expect(html).toContain(`${recipe.output} ${vi.products[product]}`);
  expect(html).toContain(`<td>${recipe.gold}</td>`);
  expect(html).toContain('class="shortage"');
 });
 it('uses fabric goods inventory for clothing, and reflects stock changes',()=>{
  const player=createCompany(0);player.products.fabric=3;
  const html=renderToStaticMarkup(createElement(GoodsRecipeDetails,{product:'clothing',player}));
  expect(html).toContain('class="enough"><th>Vải dệt</th><td>1</td><td>3</td>');
  player.products.fabric=0;
  expect(renderToStaticMarkup(createElement(GoodsRecipeDetails,{product:'clothing',player}))).toContain('class="shortage"><th>Vải dệt</th><td>1</td><td>0</td>');
 });
});
