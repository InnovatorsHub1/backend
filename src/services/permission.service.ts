import { IPermission } from "@gateway/repositories/permission/IPermission";
import { PermissionRepository } from "@gateway/repositories/permission/PermisssionRepository";
import { tryCatchAsync } from "@gateway/utils/tryCatches";

export class permissionService {

    private permissionRepository: PermissionRepository;

    constructor() {
        this.permissionRepository = new PermissionRepository();
    }

    async createPermission(permission: IPermission) {
        const { data, error } = await tryCatchAsync(async () => this.permissionRepository.create(permission))
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }

    async updatePermission(id: string, permission: Partial<IPermission>) {
        const { data, error } = await tryCatchAsync(async () => this.permissionRepository.update(id, permission));
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }

    async deletePermission(id: string) {
        const { data, error } = await tryCatchAsync(async () => this.permissionRepository.delete(id));
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }

    async getPermission(id: string) {
        const { data, error } = await tryCatchAsync(async () => this.permissionRepository.findById(id));
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }

    async getAllPermissions() {
        const { data, error } = await tryCatchAsync(async () => this.permissionRepository.findMany({}));
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }
}
