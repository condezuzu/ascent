import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:8090';
const base = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: quien } = await base.auth.signInWithPassword({
  email: process.env.CONEXION_EMAIL,
  password: process.env.CONEXION_PASSWORD,
});
const UID = quien.user.id;

const { data: ejs } = await base.from('ejercicios').select('id, nombre, orden').order('orden').limit(3);
console.log('primeros ejercicios:', JSON.stringify(ejs));

const antes = await base.from('prs').select('id').eq('user_id', UID);
const IDS = new Set((antes.data ?? []).map((r) => r.id));

await base.from('prs').insert({ user_id: UID, ejercicio: ejs[0].id, peso: 137, reps: 1, es_real: true, fecha: new Date().toISOString().slice(0, 10) });

const { data: f } = await base.rpc('mi_fuerza');
console.log('mi_fuerza.marcas:', JSON.stringify(f?.marcas));
console.log('mi_fuerza.falta:', f?.falta);

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
await page.waitForTimeout(9000);
const ent = page.getByText('Entendido', { exact: true });
if (await ent.isVisible().catch(() => false)) await ent.click();
await page.waitForTimeout(2000);
await page.goto(BASE + '/marcas', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
console.log('\n--- lo que dice /marcas ---');
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));

const sobra = (await base.from('prs').select('id').eq('user_id', UID)).data.map((r) => r.id).filter((id) => !IDS.has(id));
if (sobra.length) await base.from('prs').delete().in('id', sobra);
console.log('\n(limpiadas', sobra.length, ')');
await nav.close();
