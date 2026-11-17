import test from 'node:test';
import assert from 'node:assert/strict';
import { isLandline, readyMessage, whatsappLink } from '../src/lib/whatsapp';

test('readyMessage greets by first name and gives the Lisbon pickup day and time', () => {
  const message = readyMessage('Inês Santos', '2026-11-24T10:30:00+00:00');
  assert.match(message, /^Olá Inês!/);
  assert.match(message, /terça-feira, 24 de novembro, às 10:30/);
  assert.match(readyMessage(undefined, '2026-11-24T10:30:00+00:00'), /^Olá! /);
});

test('whatsappLink builds a wa.me link with country code and an encoded message', () => {
  const link = whatsappLink('+351 912 345 678', 'Olá Inês! Está pronta & fresca.');
  assert.equal(link, 'https://wa.me/351912345678?text=Ol%C3%A1%20In%C3%AAs!%20Est%C3%A1%20pronta%20%26%20fresca.');
  assert.equal(whatsappLink('912345678', 'x'), 'https://wa.me/351912345678?text=x');
  assert.equal(whatsappLink('253 123 400', 'x'), 'https://wa.me/351253123400?text=x');
});

test('whatsappLink returns null for missing or invalid phones', () => {
  assert.equal(whatsappLink(undefined, 'x'), null);
  assert.equal(whatsappLink('12345', 'x'), null);
  assert.equal(whatsappLink('abc', 'x'), null);
});

test('isLandline flags numbers starting with 2 only', () => {
  assert.equal(isLandline('253 123 400'), true);
  assert.equal(isLandline('+351 912 345 678'), false);
  assert.equal(isLandline(undefined), false);
});
