import IHuddlyDeviceAPI from '@huddly/sdk/lib/src/interfaces/iHuddlyDeviceAPI';
import { EventEmitter } from 'events';
import IUVCControlAPI from '@huddly/sdk/lib/src/interfaces/iUVCControlApi';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import DeviceApiOpts from '@huddly/sdk/lib/src/interfaces/IDeviceApiOpts';
import DeviceDiscoveryManager from './manager';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import HuddlyDevice from './networkdevice';
import GrpcTransport from './transport';
import IGrpcTransport from '@huddly/sdk/lib/src/interfaces/IGrpcTransport';

export default class HuddlyDeviceApiIP implements IHuddlyDeviceAPI {
    eventEmitter: EventEmitter;
    deviceDiscoveryManager: DeviceDiscoveryManager;

    private readonly SUPPORTED_DEVICES: String[] = ['L1'];

    constructor(opts: DeviceApiOpts = {}) {
        this.deviceDiscoveryManager = opts.manager || new DeviceDiscoveryManager(opts);
    }

    async initialize() {}

    registerForHotplugEvents(eventEmitter: EventEmitter): void {
        this.eventEmitter = eventEmitter;
        this.deviceDiscoveryManager.registerForHotplugEvents(eventEmitter);
    }

    async getDeviceDiscoveryAPI(): Promise<IDeviceDiscovery> {
        return this.deviceDiscoveryManager;
    }

    async getValidatedTransport(device: HuddlyDevice): Promise<IGrpcTransport> {
        if (!device) {
            Logger.warn('Device is undefined!', HuddlyDeviceApiIP.name);
            return undefined;
        }

        if (
            device &&
            (device.manufacturer != 'Huddly' || !this.SUPPORTED_DEVICES.includes(device.name))
        ) {
            Logger.warn(
                `There is no supported ip/network transport implementation for given device!`,
                HuddlyDeviceApiIP.name
            );
            Logger.warn(`Device is: ${device.toString()}`);
            return undefined;
        }

        try {
            const transport = await this.getTransport(device);
            // TODO: some sort of handshake ?
            Logger.info('Transport protocol is GRPC', HuddlyDeviceApiIP.name);
            return transport;
        } catch (e) {
            // TODO: catch specific exception
            Logger.error(
                `GRPC Transport implementation not supported for device ${device.toString()}`,
                e,
                HuddlyDeviceApiIP.name
            );
            return undefined;
        }
    }

    async getTransport(device: HuddlyDevice): Promise<IGrpcTransport> {
        const transport = new GrpcTransport(device);
        await transport.init();
        return transport;
    }

    async isUVCControlsSupported(_: any) {
        return Promise.resolve(false);
    }

    async getUVCControlAPIForDevice(_: any): Promise<IUVCControlAPI> {
        throw new Error('UVCControlInterface API not supported for network/ip cameras');
    }

    async isHIDSupported(_: any) {
        return Promise.resolve(false);
    }

    async getHIDAPIForDevice(_: any): Promise<any> {
        throw new Error('HID not supported for network/ip cameras');
    }
}
