import type { IocContainer, ServiceIdentifier } from "@tsoa/runtime";
import { container } from "./dependencyInjection.js";

/**
 * Pod intre router-ul generat de tsoa si tsyringe, ca instantele de
 * controller sa primeasca in continuare dependintele prin DI.
 */
export const iocContainer: IocContainer = {
  get: <T>(controller: ServiceIdentifier<T>): T =>
    container.resolve<T>(controller as never),
};
