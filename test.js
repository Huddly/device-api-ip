var Manager = require('./lib/manager').default;
const EventEmitter = require('events');

const main = async () => {

    var manager = new Manager();

    class MyEmitter extends EventEmitter {}
    const myEmitter = new MyEmitter();
    manager.registerForHotplugEvents(myEmitter);

    /*
    // List devices example

    const list = await manager.deviceList();
    console.log(`List contains ${list.length} devices `);
    list.forEach((d) => {
        console.log(d.toString());
    })
    */

    /*
    // Get device example
    manager.getDevice('12101A0026').then((device) => {
        console.log("Device with serial 12101A0026 found")
    }).catch((reason) => {
        console.log(reason);
    });
    */
}

main();