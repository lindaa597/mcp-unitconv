import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, dimensionOf, supportedUnits } from '../src/units.ts';

test('length conversion', () => {
  const r = convert(1, 'km', 'm');
  assert.equal(r.value, 1000);
  assert.equal(r.dimension, 'length');
});

test('mass conversion', () => {
  const r = convert(1, 'kg', 'g');
  assert.equal(r.value, 1000);
});

test('time conversion', () => {
  const r = convert(1, 'h', 'min');
  assert.equal(r.value, 60);
});

test('imperial length round-trips through the base unit', () => {
  const r = convert(1, 'mi', 'ft');
  assert.ok(Math.abs(r.value - 5280) < 1e-6);
});

test('temperature: celsius to fahrenheit', () => {
  const r = convert(100, 'C', 'F');
  assert.equal(r.value, 212);
  assert.equal(r.dimension, 'temperature');
});

test('temperature: fahrenheit to celsius', () => {
  const r = convert(32, 'F', 'C');
  assert.equal(r.value, 0);
});

test('temperature: celsius to kelvin', () => {
  const r = convert(0, 'C', 'K');
  assert.ok(Math.abs(r.value - 273.15) < 1e-9);
});

test('same unit is a no-op', () => {
  assert.equal(convert(5, 'm', 'm').value, 5);
  assert.equal(convert(5, 'C', 'C').value, 5);
});

test('dimension mismatch throws', () => {
  assert.throws(() => convert(1, 'km', 'kg'), /量纲不匹配/);
});

test('unknown unit throws', () => {
  assert.throws(() => convert(1, 'km', 'parsecs'), /未知单位/);
  assert.throws(() => convert(1, 'parsecs', 'km'), /未知单位/);
});

test('non-finite value throws', () => {
  assert.throws(() => convert(NaN, 'm', 'km'), /value/);
  assert.throws(() => convert(Infinity, 'm', 'km'), /value/);
});

test('dimensionOf finds the right table', () => {
  assert.equal(dimensionOf('kg'), 'mass');
  assert.equal(dimensionOf('ms'), 'time');
  assert.equal(dimensionOf('parsecs'), null);
});

test('supportedUnits includes every table plus temperature', () => {
  const units = supportedUnits();
  for (const u of ['m', 'kg', 's', 'C', 'F', 'K']) {
    assert.ok(units.includes(u), `expected ${u} in supportedUnits()`);
  }
});
