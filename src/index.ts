import { EventEmitter } from 'events';

import IHuddlyDeviceAPI from '@huddly/sdk-interfaces/lib/interfaces/IHuddlyDeviceAPI';
import IUVCControlAPI from '@huddly/sdk-interfaces/lib/interfaces/IUVCControlApi';
import IDeviceDiscovery from '@huddly/sdk-interfaces/lib/interfaces/IDeviceDiscovery';
import DeviceApiOpts from '@huddly/sdk-interfaces/lib/interfaces/IDeviceApiOpts';
import IGrpcTransport from '@huddly/sdk-interfaces/lib/interfaces/IGrpcTransport';
import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';
import Logger from '@huddly/sdk-interfaces/lib/statics/Logger';

import DeviceDiscoveryManager from './manager';
import HuddlyDevice from './networkdevice';
import GrpcTransport from './transport';

export default class HuddlyDeviceApiIP implements IHuddlyDeviceAPI {
    eventEmitter: EventEmitter;
    deviceDiscoveryManager: DeviceDiscoveryManager;

    private readonly SUPPORTED_DEVICE_PIDS: Number[] = [HuddlyHEX.L1_PID, HuddlyHEX.S1_PID];

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

        if (!this.SUPPORTED_DEVICE_PIDS.includes(device.productId)) {
            Logger.warn(
                `GRPC is not supported for Huddly device with PID ${device.productId}`,
                HuddlyDeviceApiIP.name
            );
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
