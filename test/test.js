// Простой тест для CalDAV node
const Caldav = require('../dist/nodes/Caldav/Caldav.node.js');

console.log('CalDAV node loaded successfully!');
console.log('Node description:', Caldav.Caldav.description.displayName);
console.log('Available operations:', Caldav.Caldav.description.properties.find(p => p.name === 'operation')?.options?.map(o => o.name)); 