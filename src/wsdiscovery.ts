import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import HuddlyDevice from './networkdevice';
import { EventEmitter } from 'events';
import et from 'elementtree';
import { v4 as uuidv4 } from 'node-uuid';
import dgram from 'dgram';
import { networkInterfaces } from 'os';

export const HUDDLY_L1_PID = 3e9; // 1001 for L1/Ace

export default class WsDiscovery extends EventEmitter {
    logger: any;
    maxDelay: number;
    opts: any;
    socket: dgram.Socket;
    readonly HUDDLY_MAC_SERIES_START: Number = 0x90e2fc900000;
    readonly HUDDLY_MAC_SERIES_END: Number = 0x90e2fc9fffff;
    readonly HUDDLY_MANUFACTURER_NAME: String = 'Huddly';

    constructor(logger: any = undefined, options: any = {}) {
        super();
        this.logger = logger || new Logger(true);
        this.opts = options;
        this.opts.timeout = options.timeout || 5000;

        this.socket = options.socket || dgram.createSocket('udp4');
        this.socket.bind(() => {
            const baseAddress = this.getBaseAddress();
            if (baseAddress || this.opts.multicastInterfaceAddr) {
                const multicastInterfaceAddr = this.opts.multicastInterfaceAddr || baseAddress;
                this.socket.setMulticastInterface(multicastInterfaceAddr);
            }
        });
        this.socket.on('error', err => {
            this.emit('ERROR', err);
        });
    }

    getBaseAddress(): string {
        const interfaceMap = networkInterfaces();
        let baseIp;
        for (const [k, v] of Object.entries(interfaceMap)) {
            if (v instanceof Array) {
                v.forEach((networkInterface: any) => {
                    if (networkInterface.family === 'IPv4' && this.manufacturerFromMac(networkInterface.mac)) {
                        baseIp = networkInterface.address;
                    }
                });
            }
        }

        return baseIp;
    }

    generateMessageId(): String {
        return 'urn:uuid:' + uuidv4();
    }

    setTimeoutWithRandomDelay(fn: any, max: number): void {
        setTimeout(fn, Math.floor(Math.random() * max));
    }

    manufacturerFromMac(mac: String): String {
        const numericMac = parseInt(mac.split(':').join(''), 16);
        return numericMac >= this.HUDDLY_MAC_SERIES_START &&
            numericMac <= this.HUDDLY_MAC_SERIES_END
            ? this.HUDDLY_MANUFACTURER_NAME
            : '';
    }

    networkDevicePID(name: String): number {
        switch (name) {
            case 'L1':
                return HUDDLY_L1_PID;
            default:
                return 0x00;
        }
    }

    parseOnvifScopes(scopes: String[], name: String, defaultValue: String[] = ['N/A']): String[] {
        const regex = `(?<=${name}/).*?(?=$|\\s)`;

        const foundValue = [];
        for (let i = 0; i < scopes.length; i++) {
            const element = scopes[i];
            const found = element.match(regex);
            if (found != undefined) {
                foundValue.push(found[0]);
            }
        }
        return foundValue.length > 0 ? foundValue : defaultValue;
    }

    makeDiscoveryBody(msgId: String): Buffer {
        const body =
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"' +
            'xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"' +
            'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"' +
            'xmlns:tds="https://www.onvif.org/ver10/device/wsdl/devicemgmt.wsdl"' +
            'xmlns:dn="http://www.onvif.org/ver10/network/wsdl">' +
            '<e:Header>' +
            `<w:MessageID>${msgId}</w:MessageID>` +
            '<w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>' +
            '<w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>' +
            '</e:Header>' +
            '<e:Body>' +
            '<d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe>' +
            '</e:Body>' +
            '</e:Envelope>';
        return Buffer.from(body);
    }

    probe(callback: any = () => { }): void {
        const self = this;

        const messageId = this.generateMessageId();
        const body = this.makeDiscoveryBody(messageId);
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

                    const macAddr = this.parseOnvifScopes(scopes, 'mac')[0];
                    const name = this.parseOnvifScopes(scopes, 'name', ['Unknown_Device'])[0];
                    const deviceData = {
                        name: name,
                        mac: macAddr,
                        ip: ipv4Addr[0],
                        serialNumber: this.parseOnvifScopes(scopes, 'serial')[0],
                        types: this.parseOnvifScopes(scopes, 'type'),
                        scopes: scopes,
                        xaddrs: match.findtext('wsdd:XAddrs'),
                        modelName: this.parseOnvifScopes(scopes, 'hardware')[0],
                        manufacturer: this.manufacturerFromMac(macAddr),
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

        this.setTimeoutWithRandomDelay(
            this.socket.send.bind(this.socket, body, 0, body.length, 3702, '239.255.255.250'),
            this.maxDelay
        );
    }

    close() {
        if (this.socket != undefined) {
            this.socket.once('close', this.emit.bind(this, 'close'));
            this.socket.close();
        }
        this.socket = undefined;
    }
}
