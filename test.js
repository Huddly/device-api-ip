var Manager = require('./lib/manager').default;
const EventEmitter = require('events');

var manager = new Manager();

class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();
manager.registerForHotplugEvents(myEmitter);
