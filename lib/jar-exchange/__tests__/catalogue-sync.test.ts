import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  jarFlavourProductId,
  jarFlavourSku,
} from '@/lib/jar-exchange/catalogue-sync';

describe('jar catalogue identity', () => {
  it('builds stable SKU and productId from flavour code', () => {
    assert.equal(jarFlavourSku('chicken-20'), 'RF-chicken-20');
    assert.equal(jarFlavourSku(' Chicken-20 '), 'RF-chicken-20');
    assert.equal(jarFlavourProductId('chicken-20'), 'JAR-CHICKEN-20');
    assert.equal(jarFlavourProductId('crystal-fish-10'), 'JAR-CRYSTAL-FISH-10');
  });
});
