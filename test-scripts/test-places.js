const express = require('express');
const request = require('supertest');
const app = require('./app');
const { sequelize } = require('./models');

async function test() {
  try {
    console.log('--- Test GET /v1/places ---');
    const res1 = await request(app).get('/v1/places');
    console.log('Status:', res1.status);
    console.log('Body length:', res1.body.length);
    if (res1.body.length > 0) {
      console.log('First place:', res1.body[0]);
    }

    console.log('\n--- Test GET /v1/places?cityName=Paris ---');
    const res2 = await request(app).get('/v1/places?cityName=Paris');
    console.log('Status:', res2.status);
    console.log('Body length:', res2.body.length);
    res2.body.forEach(p => console.log(`- ${p.street} (${p.city})`));

    console.log('\n--- Test GET /v1/places?limit=2 ---');
    const res3 = await request(app).get('/v1/places?limit=2');
    console.log('Status:', res3.status);
    console.log('Body length:', res3.body.length);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

test();
