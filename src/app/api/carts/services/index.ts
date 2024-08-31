import { ICart } from "@/types/cart";
import { ICompany } from "@/types/company";
import { CartStatus, PrismaClient } from "@prisma/client";
import { io } from "socket.io-client";
import * as geolib from "geolib";
const prisma = new PrismaClient();

export async function addCartService(cart: ICart) {
  try {
    const client = await prisma.users.findUnique({
      where: { id: cart.clientId },
    });
    if (!client) {
      throw new Error("the client id is wrong");
    }
    if (!cart.companiesIds || cart.companiesIds.length == 0) {
      throw new Error("the companiesIds is empty");
    }

    
 
    const searchCompanies = await prisma.companies.findMany({
      where: {
        id: {
          in: cart.companiesIds,
        },
      },
    });
    if (searchCompanies.length == 0) {
      throw new Error("company/companies does not exist");
    }
    const cartAdded = await prisma.carts.create({
      data: {
        orders: cart.orders,
        location: cart.location,
        totalPrice: cart.totalPrice,
        clientId: cart.clientId,
        deliveryManAccountId: cart.deliveryManAccountId,
        status: cart.status as CartStatus,
        companiesIds: cart.companiesIds,
      },
    });

    return cartAdded;
  } catch (error) {
    console.error("Error creating cart:", error);
    throw error;
  }
}

export async function getAllCartsService(limit: number, page: number) {
  try {
    const offset = (page - 1) * limit;
    const totalItems = await prisma.carts.count();

    if (totalItems === 0) {
      return null;
    }

    const carts = await prisma.carts.findMany({
      skip: offset,
      take: limit,
    });

    const totalPages = Math.ceil(totalItems / limit);

    return {
      carts,
      pagination: {
        page,
        limit,
        totalPages,
        totalItems,
      },
    };
  } catch (error) {
    console.error("Error fetching carts:", error);
    throw error;
  }
}
export async function getCartByIdService(id: string) {
  try {
    const cart = await prisma.carts.findUnique({
      where: { id },
    });
    if (!cart) {
      return null;
    }
    return cart;
  } catch (error) {
    console.error("Error fetching cart:", error);
    throw error;
  }
}

export async function updateCartByIdService(
  cartId: string,
  cart: Partial<ICart>
) {
  try {
    const existingCart = await prisma.carts.findUnique({
      where: { id: cartId },
    });
    if (!existingCart) {
      return null;
    }
    const updatedCart = await prisma.carts.update({
      where: { id: cartId },
      data: cart,
    });
    return updatedCart;
  } catch (error) {
    console.error("Error updating cart:", error);
    throw error;
  }
}

export async function deleteCartByIdService(cartId: string) {
  try {
    const cart = await prisma.carts.findUnique({
      where: { id: cartId },
    });
    if (!cart) {
      return null;
    }
    await prisma.carts.delete({
      where: { id: cartId },
    });
    return cart;
  } catch (error) {
    console.error("Error deleting cart:", error);
    throw error;
  }
}

export async function groupCompaniesByDistance(
  companyIds: string[]
): Promise<Object> {
  try {
    if (companyIds.length == 0) throw new Error("companyIds is empty"); 
    
    
    if (companyIds.length == 1)  {

      let companiesData = [await prisma.companies.findFirst({
        where:{
          id:companyIds[0]
        }
      })]

      return {grouppedCompanies:{[companyIds[0]]: {
        near: []
      }} , companiesData:companiesData 
    }; }
    let nonDuplicatedCompaniesIds = Array.from(new Set<string>(companyIds));
    
    let objectOfCompanies: { [key: string]: { near: string[] } } = {};
    let seenIds = new Set<string>();

    let companies = await prisma.companies.findMany({
      where: {
        id: {
          in: nonDuplicatedCompaniesIds,
        },
      },
    });
 

    nonDuplicatedCompaniesIds.forEach((companyId: string) => {
      objectOfCompanies[companyId] = { near: [] };


    }); 
    
    companies.forEach((company: any) => {
      let { id } = company;
      let locationOne = company.location;
      nonDuplicatedCompaniesIds.forEach((companyId: string) => {
        let locationTwo = companies.find(
          (c: any) => c.id === companyId
        )?.location;
        let distance = 0;
        if (id == companyId) return; 
        if (locationTwo) {
          distance = geolib.getDistance(locationOne, locationTwo);
        }
        if (
          distance >= parseInt(process.env.DISTANCE_BETWEEN_COMPANIES as string)
        ) {
          return;
        }
        if (companyId !== id && !seenIds.has(id)) {
          objectOfCompanies[companyId].near.push(id);
          seenIds.add(id);
          seenIds.add(companyId);
        }
      });
    });

    Object.keys(objectOfCompanies).forEach((companyId) => {
      if (objectOfCompanies[companyId].near.length === 0) {
        let existsInOtherNear = Object.keys(objectOfCompanies).some(
          (otherCompanyId) =>
            objectOfCompanies[otherCompanyId].near.includes(companyId)
        );

        if (existsInOtherNear) {
          delete objectOfCompanies[companyId];
        }
      }
    });
    return { grouppedCompanies: objectOfCompanies, companiesData: companies };
  } catch (error) {
    throw error;
  }
}
interface IGetDeliveryMans {
  deliveryMen: Array<{ id: string; coords: { latitude: number; longitude: number } }> 
}



function waitForDeliveryMenList(socket: any): Promise<IGetDeliveryMans> {
  return new Promise((resolve, reject) => {
    
    socket.on("delivery-men-list", (data: IGetDeliveryMans) => {
      resolve(data);
    });

    // Optional: Handle errors or timeouts
    socket.once("error", (err: any) => {
      reject(err);
    });
  });
}

interface deliveryMansPerCompanies {
  deliverymanIds: string[];
  groupOfCompanies: string[];
  dataOfGroupedCompanies: any[];
}

export async function getNearestDeliveryMans(companiesData: any, orders: IOrder[], clientId: string, userLocation: { latitude: number, longitude: number }) : Promise<any> {
  const socket = io("http://192.168.1.4:8080" , {
    transports: ["polling"], 
  });
  try {
    if (!companiesData) throw new Error("companiesData is empty");
    if (!orders) throw new Error("orders is empty");

    let companies = companiesData.companiesData as ICompany[];
    let { grouppedCompanies } = companiesData;
    let filtredCompanies = Object.keys(grouppedCompanies).map((id: string) => {
      return companies.find((c) => c.id === id);
    });

    socket.emit("get-delivery-men");
    let dataFromSocket = await waitForDeliveryMenList(socket); 

    if(dataFromSocket.deliveryMen.length == 0) {
       throw new Error("Aucun livreurs présents.")
    }
    let deliveryMansPerCompanies: deliveryMansPerCompanies[] = [];
    filtredCompanies.forEach((company: any) => {
      if (dataFromSocket.deliveryMen.length == 0) return;
      let deliveryManWithDistance = dataFromSocket.deliveryMen.map((d: any) => {
        return { id: d.id, distance: geolib.getDistance(d.coords, company.location) }
      });

      if (dataFromSocket.deliveryMen.length === 1) {
        deliveryMansPerCompanies.push({
          deliverymanIds: [dataFromSocket.deliveryMen[0].id],
          groupOfCompanies: [company.id, ...grouppedCompanies[company.id].near],
          dataOfGroupedCompanies: [company, ...grouppedCompanies[company.id].near.map((id: string) => companies.find((c: any) => c.id === id))],
        });
      } else {
        let sortedDeliveryMansArray = deliveryManWithDistance.sort((a, b) => a.distance - b.distance).slice(0, 5);
        deliveryMansPerCompanies.push({
          deliverymanIds: sortedDeliveryMansArray.map((d) => d.id),
          groupOfCompanies: [company.id, ...grouppedCompanies[company.id].near],
          dataOfGroupedCompanies: [company, ...grouppedCompanies[company.id].near.map((id: string) => companies.find((c: any) => c.id === id))],
        });
      }
    });

    let deliveryMansPerCompaniesAddedOrders = deliveryMansPerCompanies.map((d: any) => {
      d.dataOfGroupedCompanies.forEach((c: any) => {
        let { id } = c;
        let selectedOrders = orders.filter((o: any) => o.restaurantId === id);
        c.orders = selectedOrders;
      });
      return d;
    });

    let objectOfCartsPromises = deliveryMansPerCompaniesAddedOrders.flatMap((obj: any) => {
      let { dataOfGroupedCompanies } = obj;
      return dataOfGroupedCompanies.flatMap((c: any) => {
        let { orders } = c; 
        return addCartService({
          orders: orders.map((o: any) => o.id),
          location: userLocation,
          totalPrice: orders.reduce((acc: number, o: any) => acc + o.price, 0),
          clientId: clientId,
          status: "step0",
          companiesIds: obj.groupOfCompanies,
        });
      });
    });

    let objectOfCarts = await Promise.all(objectOfCartsPromises);  
    socket.emit("companies-notifications", {room:objectOfCarts});
    socket.disconnect()
    return {data : deliveryMansPerCompaniesAddedOrders , carts:objectOfCarts};

  } catch (error) {
    throw error
  }
}


  