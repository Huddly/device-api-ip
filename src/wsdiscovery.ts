import HuddlyDevice from './networkdevice';
import { EventEmitter } from 'events';
import et from 'elementtree';
import { v4 as uuidv4 } from 'node-uuid';
import dgram from 'dgram';
import { networkInterfaces } from 'os';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import {
    getInterfaceWithHuddlyDevice,
    makeDiscoveryBody,
    manufacturerFromMac,
    parseOnvifScopes,
} from './utils';

export const HUDDLY_L1_PID = 3e9; // 1001 for L1/Ace

export default class WsDiscovery extends EventEmitter {
    maxDelay: number;
    opts: any;
    socket: dgram.Socket;
    interfaceWatcher: any;
    ifStateConnected: boolean = true;

    readonly HUDDLY_MAC_SERIES_START: Number = 0x90e2fc900000;
    readonly HUDDLY_MAC_SERIES_END: Number = 0x90e2fc9fffff;
    readonly HUDDLY_MANUFACTURER_NAME: String = 'Huddly';

    constructor(options: any = {}) {
        super();
        this.opts = options;
        this.opts.timeout = options.timeout || 5000;

        this.bindSocket();
    }

    bindSocket(): void {
        this.socket = this.opts.socket || dgram.createSocket('udp4');
        this.socket.bind(() => {
            const map = this.getBaseInterface();
            if ((map.ip && map.interface) || this.opts.multicastInterfaceAddr) {
                const multicastInterfaceAddr = this.opts.multicastInterfaceAddr || map.ip;
                this.socket.setMulticastInterface(multicastInterfaceAddr);
            }
            if (!this.interfaceWatcher) {
                this.watchInterface(map.interface || 'default');
            }
        });
        this.socket.on('error', err => {
            this.emit('ERROR', err);
        });
    }

    watchInterface(interfaceName: string): void {
        if (interfaceName === 'default') {
            // No need to watch interface detach when socket is bound to all interfaces
            return;
        }
        this.interfaceWatcher = setInterval(() => {
            const interfaceMap = networkInterfaces();
            if (Object.keys(interfaceMap).indexOf(interfaceName) > -1 && !this.ifStateConnected) {
                this.bindSocket();
                this.ifStateConnected = true;
            } else if (Object.keys(interfaceMap).indexOf(interfaceName) === -1) {
                if (this.ifStateConnected) {
                    // Close socket only if it was bound and the interface was deactivated
                    Logger.debug(
                        `Network interface [${interfaceName}] removed. Bring interface up to rediscover Huddly network cameras`,
                        WsDiscovery.name
                    );
                    this.socket.close();
                }
                this.ifStateConnected = false;
            }
        }, 1000);
    }

    getBaseInterface(): any {
        const interfaceMap = networkInterfaces();
        const map = { ip: undefined, interface: undefined };
        for (const [k, v] of Object.entries(interfaceMap)) {
            if (v instanceof Array) {
                v.forEach((networkInterface: any) => {
                    if (
                        networkInterface.family === 'IPv4' &&
                        manufacturerFromMac(networkInterface.mac)
                    ) {
                        map.ip = networkInterface.address;
                        map.interface = k;
                    }
                });
            }
        }

        return map;
    }

    generateMessageId(): String {
        return 'urn:uuid:' + uuidv4();
    }

    setTimeoutWithRandomDelay(fn: any, max: number): void {
        setTimeout(fn, Math.floor(Math.random() * max));
    }

    networkDevicePID(name: String): number {
        switch (name) {
            case 'L1':
                return HUDDLY_L1_PID;
            default:
                return 0x00;
        }
    }

    probe(callback: any = () => {}): void {
        const self = this;

        const messageId = this.generateMessageId();
        const body = makeDiscoveryBody(messageId);
        const discoveredDevices: HuddlyDevice[] = [];
        const onProbeResponseHandler = (message: any) => {
            const tree = et.parse(message.toString());
            const relatesTo = tree.findtext('*/wsa:RelatesTo');
            if (relatesTo === messageId) {
                const matches = tree.findall('*/*/wsdd:ProbeMatch');
                matches.forEach(match => {
                    const ipv4Addr = match
                        .findtext('wsdd:XAddrs')
                        .toString()
                        .match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
                    const scopes = match
                        .findtext('wsdd:Scopes')
                        .toString()
                        .split(' ');

                    const macAddr = parseOnvifScopes(scopes, 'mac')[0];
                    const name = parseOnvifScopes(scopes, 'name', ['Unknown_Device'])[0];
                    const deviceData = {
                        name: name,
                        mac: macAddr,
                        ip: ipv4Addr[0],
                        serialNumber: parseOnvifScopes(scopes, 'serial')[0],
                        types: parseOnvifScopes(scopes, 'type'),
                        scopes: scopes,
                        xaddrs: match.findtext('wsdd:XAddrs'),
                        modelName: parseOnvifScopes(scopes, 'hardware')[0],
                        manufacturer: manufacturerFromMac(macAddr),
                        metadataVersion: match.findtext('wsdd:MetadataVersion'),
                        messageId: tree.findtext('*/wsa:MessageID'),
                        pid: this.networkDevicePID(name),
                    };
                    const device = new HuddlyDevice(deviceData);
                    discoveredDevices.push(device);
                    this.emit('device', device);
                });
            }
            callback(discoveredDevices);
        };
        this.socket.on('message', onProbeResponseHandler);
        setTimeout(() => {
            self.socket.removeListener('message', onProbeResponseHandler);
            callback(discoveredDevices);
        }, this.opts.timeout);

        if (this.ifStateConnected) {
            this.setTimeoutWithRandomDelay(
                this.socket.send.bind(this.socket, body, 0, body.length, 3702, '239.255.255.250'),
                this.maxDelay
            );
        }
    }

    close() {
        if (this.socket != undefined) {
            this.socket.once('close', this.emit.bind(this, 'close'));
            this.socket.close();
        }
        if (this.interfaceWatcher) {
            clearInterval(this.interfaceWatcher);
        }

        this.socket = undefined;
        this.interfaceWatcher = undefined;
    }
}
