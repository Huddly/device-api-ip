export default class HuddlyDevice {
    name: String;
    mac: String;
    ip: String;
    serial: String;
    types: String[];
    scopes: String[];
    xaddrs: String;
    modelName: String;
    manufacturer: String;
    metadataVersion: String;
    messageId: String;

    constructor(deviceData: any) {
        this.name = deviceData.name;
        this.mac = deviceData.mac;
        this.ip = deviceData.ip;
        this.serial = deviceData.serial;
        this.types = deviceData.types;
        this.scopes = deviceData.scopes;
        this.xaddrs = deviceData.xaddrs;
        this.modelName = deviceData.modelName;
        this.manufacturer = deviceData.manufacturer;
        this.metadataVersion = deviceData.metadataVersion;
        this.messageId = deviceData.messageId;
    }

    toString(): String {
        const deviceStringRep = [];
        deviceStringRep.push(
            `Name: ${this.name}`,
            `Manufactorer: ${this.manufacturer}`,
            `Serial: ${this.serial}`,
            `MAC Address: ${this.mac}`,
            `IPv4 Address: ${this.ip}`
        );
        return deviceStringRep.join('');
    }

    equals(device: HuddlyDevice): boolean {
        if (device != undefined) {
            if (device.mac == this.mac || device.serial == this.serial || device.ip == this.ip) {
                return true;
            }
        }
        return false;
    }
}
