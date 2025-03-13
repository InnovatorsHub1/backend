import { injectable } from "inversify";
import { RoleRepository } from "@gateway/repositories/role/RoleRepository";
import { tryCatchAsync } from "@gateway/utils/tryCatches";
import { IRole } from "@gateway/repositories/role/IRole";

@injectable()
export class RoleService {
    private roleRepository: RoleRepository;

    constructor() {
        this.roleRepository = new RoleRepository();

    }

    async createRole(role: IRole) {
        const { data, error } = await tryCatchAsync(async () => this.roleRepository.create(role))
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }

    async updateRole(id: string, role: Partial<IRole>) {
        const { data, error } = await tryCatchAsync(async () => this.roleRepository.update(id, role))
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }

    async deleteRole(id: string) {
        const { data, error } = await tryCatchAsync(async () => this.roleRepository.delete(id))
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }

    async getRole(id: string) {
        const { data, error } = await tryCatchAsync(async () => this.roleRepository.getById(id))
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }

    async getAllRoles() {
        const { data, error } = await tryCatchAsync(async () => this.roleRepository.findAllRoles())
        if (error) {
            throw new Error(error as string);
        }
        return data;
    }
}
