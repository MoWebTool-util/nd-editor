'use strict'

// var $ = require('nd-jquery')
var chai = require('chai')
var sinonChai = require('sinon-chai')
var Editor = require('../index')

var expect = chai.expect
// var sinon = window.sinon

chai.use(sinonChai)

/* globals describe,it */

describe('Editor', function() {
  it('function', function() {
    expect(Editor).to.be.a('function')
  })

  it('new Editor', function() {
    expect(new Editor).to.have.property('execute')
  })
})
