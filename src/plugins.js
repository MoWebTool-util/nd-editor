'use strict';

module.exports = [
  {
    name: 'paste',
    starter: require('./plugins/paste')
  },
  {
    name: 'source',
    starter: require('./plugins/source')
  },
  {
    name: 'history',
    starter: require('./plugins/history')
  },
  // {
  //   name: 'direction',
  //   starter: require('./plugins/direction')
  // },
  {
    name: 'format',
    starter: require('./plugins/format')
  },
  {
    name: 'alignment',
    starter: require('./plugins/alignment')
  },
  // {
  //   name: 'blockquote',
  //   starter: require('./plugins/blockquote')
  // },
  {
    name: 'lists',
    starter: require('./plugins/lists')
  },
  {
    name: 'link',
    starter: require('./plugins/link')
  },
  {
    name: 'image',
    starter: require('./plugins/image')
  }
];
