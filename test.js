var Api = require('./lib/src/index').default;
const EventEmitter = require('events');

const main = async () => {

    var api = new Api();
    class MyEmitter extends EventEmitter {}
    const myEmitter = new MyEmitter();
    let grpcTransport;
    let mydevice;


    myEmitter.on('ATTACH', (device) => {
        mydevice = device;
        api.getValidatedTransport(device)
        .then((transport) => {
            grpcTransport = transport;
            grpcClient = transport.grpcClient;
            // TODO: Perform actions
            console.log('We can perform actions on the device now');
            console.log(mydevice);
        }).catch((e) => {
            console.log('Unable to get transport for device');
            console.error(e);
        })
    });
    myEmitter.on('DETACH', (device) => {
        if (mydevice && mydevice.equals(device)) {
            console.log('Closing grpc channel on device');
            grpcTransport.close();
        }
    });
    api.registerForHotplugEvents(myEmitter);
}

main();