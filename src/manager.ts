import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import { EventEmitter } from 'stream';
import HuddlyDevice from './networkdevice';
import WsDiscovery from './wsdiscovery';

export default class DeviceDiscoveryManager implements IDeviceDiscovery {
    private discoveredDevices: HuddlyDevice[] = [];
    private wsdd: WsDiscovery;
    eventEmitter: EventEmitter;
    logger: any;
    pollInterval: any;
    pollIntervalMs: number = 5000;

    constructor(logger: any) {
        this.logger = logger || new Logger(true);
        this.wsdd = new WsDiscovery(this.logger, { timeout: 1000 });
    }

    registerForHotplugEvents(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
        this.setupProbePoke();
    }

    listExcept(listA: HuddlyDevice[], listB: HuddlyDevice[]): HuddlyDevice[] {
        const result: HuddlyDevice[] = []; // final
        for (let i = 0; i < listA.length; i++) {
            let found = false;
            for (let j = 0; j < listB.length && !found; j++) {
                if (listA[i].equals(listB[j])) {
                    found = true;
                }
            }
            if (!found) {
                result.push(listA[i]);
            }
        }
        return result;
    }

    probeHandler(deviceList: HuddlyDevice[]): void {
        // emit attach events for all elements present in DeviceList but not preset in DiscoveredDevices
        const detachedDevices: HuddlyDevice[] = this.listExcept(this.discoveredDevices, deviceList);
        for (let i = 0; i < detachedDevices.length; i++) {
            this.logger.info(
                `Huddly ${detachedDevices[i].name} camera with [Serial: ${detachedDevices[i].serial}, MAC: ${detachedDevices[i].mac}] not available any longer`,
                WsDiscovery.name
            );
            if (this.eventEmitter) {
                this.eventEmitter.emit('DETACH', detachedDevices[i]);
            }
        }
        // Emit detach event for all the devices in the above list
        const newDevices: HuddlyDevice[] = this.listExcept(deviceList, this.discoveredDevices);
        for (let i = 0; i < newDevices.length; i++) {
            this.logger.info(
                `Found new Huddly ${newDevices[i].name} camera with [Serial: ${newDevices[i].serial}, MAC: ${newDevices[i].mac}] available at ${newDevices[i].ip}`,
                WsDiscovery.name
            );
            if (this.eventEmitter) {
                this.eventEmitter.emit('ATTACH', newDevices[i]);
            }
        }
        // Emit attach event for all the devices in the above list
        const stillAlive: HuddlyDevice[] = this.listExcept(this.discoveredDevices, detachedDevices);
        // Discovered Devices list now represents the new cameras plus the existing ones still available (i.e. stillAlive + newDevices)
        this.discoveredDevices = stillAlive.concat(newDevices);
    }

    setupProbePoke(): void {
        this.wsdd.probe((deviceList: HuddlyDevice[]) => this.probeHandler(deviceList));
        this.pollInterval = setInterval(() => {
            this.wsdd.probe((deviceList: HuddlyDevice[]) => this.probeHandler(deviceList));
        }, this.pollIntervalMs); // Poke every 5 seconds
    }

    destroy(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.wsdd.close();
    }

    deviceList(): HuddlyDevice[] {
        throw new Error('Not supported yet');
    }

    getDevice(serialNumber: string = undefined) {
        throw new Error('Not supported yet');
    }
}
