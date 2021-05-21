import IHuddlyDeviceAPI from '@huddly/sdk/lib/src/interfaces/iHuddlyDeviceAPI';
import { EventEmitter } from 'events';
import IUVCControlAPI from '@huddly/sdk/lib/src/interfaces/iUVCControlApi';
import ITransport from '@huddly/sdk/lib/src/interfaces/iTransport';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import DeviceApiOpts from '@huddly/sdk/lib/src/interfaces/IDeviceApiOpts';
import DeviceDiscoveryManager from './manager';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';

export default class HuddlyDeviceAPIUSB implements IHuddlyDeviceAPI {
    logger: any;
    eventEmitter: EventEmitter;
    deviceDiscoveryManager: DeviceDiscoveryManager;
    maxSearchRetries: Number;
    alwaysRetry: boolean;

    constructor(opts: DeviceApiOpts = {}) {
        this.logger = opts.logger || new Logger(true);
        this.deviceDiscoveryManager = opts.manager || new DeviceDiscoveryManager(this.logger);
        this.maxSearchRetries = opts.maxSearchRetries || 10;
        this.alwaysRetry = opts.alwaysRetry || false;
    }

    async initialize() {}

    registerForHotplugEvents(eventEmitter: EventEmitter): void {
        this.eventEmitter = eventEmitter;
        this.deviceDiscoveryManager.registerForHotplugEvents(eventEmitter);
    }

    async getDeviceDiscoveryAPI(): Promise<IDeviceDiscovery> {
        return this.deviceDiscoveryManager;
    }

    async getValidatedTransport(device): Promise<ITransport> {
        throw new Error('Not supported yet');
        // TODO
    }

    async getTransport(device): Promise<any> {
        throw new Error('Not supported yet');
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
