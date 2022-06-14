import HuddlyDevice from './networkdevice';
import { EventEmitter } from 'events';
import et from 'elementtree';
import { v4 as uuidv4 } from 'node-uuid';
import dgram from 'dgram';
import { networkInterfaces } from 'os';

import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';

interface InterfaceMap {
    interfaceName: string;
    ip: string;
}

interface DiscoveredInterfaces {
    targetInterface: InterfaceMap;
    linkLocalMaps: InterfaceMap[];
}

export default class WsDiscovery extends EventEmitter {
    maxDelay: number;
    opts: any;
    networkInterfacesWatcher: any;
    socketConnections: NodeJS.Dict<dgram.Socket> = {};

    readonly HUDDLY_MAC_SERIES_START: Number = 0x90e2fc900000;
    readonly HUDDLY_MAC_SERIES_END: Number = 0x90e2fc9fffff;
    readonly HUDDLY_MANUFACTURER_NAME: String = 'Huddly';

    constructor(options: any = {}) {
        super();
        this.opts = options;
        this.opts.timeout = options.timeout || 1000;

        Logger.debug(
            `WsDiscovery initilized with the following options: ${JSON.stringify(this.opts)}`,
            WsDiscovery.name
        );
        this.initNetworkInterfaces();
        this.watchNetworkInterfaces();
    }

    initSocketConnection(
        interfaceMap: InterfaceMap = { interfaceName: 'default', ip: undefined }
    ): dgram.Socket {
        Logger.debug(
            `Discovery probe messages bound to target interface [${interfaceMap.interfaceName}] on addr ${interfaceMap.ip}`,
            WsDiscovery.name
        );
        const socketConnection = dgram.createSocket('udp4');
        this.bindSocket(interfaceMap, socketConnection);
        return socketConnection;
    }

    initNetworkInterfaces(): void {
        const probeEntireNetwork =
            this.opts.probeEntireNetwork || process.env.HUDDLY_WSDD_PROBE_ENTIRE_NETWORK;
        const networkInterfaces = this.findNetworkInterfaces();
        if (this.opts.targetInterfaceAddr || this.opts.targetInterfaceName) {
            const { interfaceName, ip } = networkInterfaces.targetInterface;
            if (!ip) {
                Logger.debug(
                    `Unable to locate target interface with ip address ${this.opts.targetInterfaceAddr} or name ${this.opts.targetInterfaceName}`,
                    WsDiscovery.name
                );
                return;
            }
            this.socketConnections[interfaceName] = this.initSocketConnection(
                networkInterfaces.targetInterface
            );
            return;
        }

        if (probeEntireNetwork) {
            this.socketConnections['default'] = this.initSocketConnection();
            Logger.debug(`Probing entire network for Huddly IP Cameras.`, WsDiscovery.name);
            return;
        }

        if (networkInterfaces.linkLocalMaps.length > 0) {
            networkInterfaces.linkLocalMaps.forEach(map => {
                this.socketConnections[map.interfaceName] = this.initSocketConnection(map);
            });
        } else {
            Logger.debug(`Unable to find any link local networks.`, WsDiscovery.name);
        }
    }

    findNetworkInterfaces(): DiscoveredInterfaces {
        const interfaces = networkInterfaces();
        const targetInterface: InterfaceMap = { interfaceName: undefined, ip: undefined };
        const linkLocalMaps = [];
        for (const [k, v] of Object.entries(interfaces)) {
            if (v instanceof Array) {
                v.forEach((networkInterface: any) => {
                    // Make sure we operate on Ipv4 addresses only
                    if (networkInterface.family === 'IPv4') {
                        // Check if the integrator has specified the target interface or one of the interfaces is huddly compatible (BASE)
                        if (this.opts.targetInterfaceName || this.opts.targetInterfaceAddr) {
                            if (
                                this.opts.targetInterfaceName == k ||
                                this.opts.targetInterfaceAddr == networkInterface.address
                            ) {
                                targetInterface.ip = networkInterface.address;
                                targetInterface.interfaceName = k;
                            }
                        } else if (this.isLinkLocalAddr(networkInterface.address)) {
                            linkLocalMaps.push({
                                ip: networkInterface.address,
                                interfaceName: k,
                            });
                        }
                    }
                });
            }
        }

        return {
            targetInterface,
            linkLocalMaps,
        };
    }

    watchNetworkInterfaces(): void {
        if (this.opts.probeEntireNetwork || process.env.HUDDLY_WSDD_PROBE_ENTIRE_NETWORK) {
            // No need to watch interfaces when socket is bound to all interfaces
            return;
        }

        Logger.debug(`Setting up network interface watcher`, WsDiscovery.name);
        const isNotInitialized = (map: InterfaceMap) => {
            return !(map.interfaceName in this.socketConnections);
        };

        const checkForDisconnect = (maps: InterfaceMap[]) => {
            const flattenedMaps = maps.map(m => m.interfaceName);
            Object.keys(this.socketConnections).forEach(k => {
                if (!flattenedMaps.includes(k)) {
                    Logger.debug(
                        `Network interface [${k}] not found. No longer doing discovery for Huddly Cameras on this interface.`,
                        WsDiscovery.name
                    );

                    this.socketConnections[k].close();
                    this.socketConnections[k] = undefined;
                    delete this.socketConnections[k];
                }
            });
        };

        this.networkInterfacesWatcher = setInterval(() => {
            const networkInterfaces = this.findNetworkInterfaces();
            if (this.opts.targetInterfaceAddr || this.opts.targetInterfaceName) {
                if (
                    networkInterfaces.targetInterface.ip &&
                    isNotInitialized(networkInterfaces.targetInterface)
                ) {
                    this.socketConnections[
                        networkInterfaces.targetInterface.interfaceName
                    ] = this.initSocketConnection(networkInterfaces.targetInterface);
                }
                checkForDisconnect([networkInterfaces.targetInterface]);
                return;
            }

            if (networkInterfaces.linkLocalMaps) {
                networkInterfaces.linkLocalMaps.forEach(map => {
                    if (isNotInitialized(map)) {
                        this.socketConnections[map.interfaceName] = this.initSocketConnection(map);
                    }
                });
            }

            checkForDisconnect(networkInterfaces.linkLocalMaps);
        }, 1000);
    }

    bindSocket(map: InterfaceMap, socket: any): void {
        if (!map.ip) {
            socket.bind();
            return;
        }
        socket.bind({ address: map.ip });
        Logger.debug(
            `Set outgoing multicast interface of socket ${map.interfaceName} to interface with address ${map.ip}`,
            WsDiscovery.name
        );
        socket.on('error', err => {
            this.emit('ERROR', err);
        });
    }

    isLinkLocalAddr(ipAddress: string): boolean {
        return ipAddress.startsWith('169.254');
    }

    isDeviceAllowed(deviceIpAddress: string): boolean {
        // Localhost ip addresses are reserved and not allowed to identify a huddly network camera
        if (deviceIpAddress === '127.0.0.1') return false;

        // This filtering only applies when probing the entire network
        const probeEntireNetwork =
            this.opts.probeEntireNetwork || process.env.HUDDLY_WSDD_PROBE_ENTIRE_NETWORK;
        const ignoreLinkLocalDevices =
            this.opts.ignoreLinkLocalDevices || process.env.HUDDLY_WSDD_IGNORE_LINK_LOCAL_DEVICES;
        const isLinkLocalAddr = this.isLinkLocalAddr(deviceIpAddress);

        if (probeEntireNetwork && ignoreLinkLocalDevices && isLinkLocalAddr) {
            return false;
        }

        return true;
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
                return HuddlyHEX.L1_PID;
            case 'S1':
                return HuddlyHEX.S1_PID;
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

    probe(callback: any = () => {}): void {
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
                    if (this.isDeviceAllowed(device.ip.toString())) {
                        if (device.manufacturer == this.HUDDLY_MANUFACTURER_NAME) {
                            discoveredDevices.push(device);
                            this.emit('device', device);
                        }
                    } else {
                        Logger.debug(
                            `Ignoring device at ip address: ${device.ip.toString()}.`,
                            WsDiscovery.name
                        );
                        Logger.debug(
                            `Ignore local link devices: ${this.opts.ignoreLinkLocalDevices ||
                                process.env.HUDDLY_WSDD_IGNORE_LINK_LOCAL_DEVICES}.`,
                            WsDiscovery.name
                        );
                        Logger.debug(
                            `Has full probing rights: ${this.opts.probeEntireNetwork ||
                                process.env.PROBE_ENTIRE_NETWORK}`,
                            WsDiscovery.name
                        );
                    }
                });
            }
        };

        if (Object.keys(this.socketConnections).length === 0) {
            callback([]);
            return;
        }

        Object.values(this.socketConnections).forEach(socket => {
            socket.on('message', onProbeResponseHandler);

            setTimeout(() => {
                socket.removeListener('message', onProbeResponseHandler);
            }, this.opts.timeout);

            this.setTimeoutWithRandomDelay(
                socket.send.bind(socket, body, 0, body.length, 3702, '239.255.255.250'),
                this.maxDelay
            );
        });
        setTimeout(() => {
            callback(discoveredDevices);
        }, this.opts.timeout);
    }

    close() {
        Object.values(this.socketConnections).forEach(socket => {
            if (socket != undefined) {
                socket.once('close', this.emit.bind(this, 'close'));
                socket.close();
            }
        });
        if (this.networkInterfacesWatcher) {
            clearInterval(this.networkInterfacesWatcher);
        }

        this.socketConnections = undefined;
        this.networkInterfacesWatcher = undefined;
    }
}
