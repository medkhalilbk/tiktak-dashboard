"use client" 
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import React from 'react';
import axios from 'axios'; 
import DataTablesOrders from '@/components/ui/orders/DataTables'; 
import { setOrders } from '@/lib/features/orderSlice'; 
export default function OrdersPage() { 

 let orders = useSelector((state: RootState) => state.orders.data);
 let dispatch = useDispatch()
React.useEffect(() => {
  if(typeof window !== 'undefined'){
    let id = localStorage.getItem('id')
    axios.get(`/api/companies/${id}/orders`).then((res)=>{
      dispatch(setOrders(res.data?.data))
    })
  }
} , [])  
React.useEffect(() => {

} , [orders])
return (
   <>
   <div className='my-3 mx-2'>
   <DataTablesOrders orders={orders} />
   </div>
   </>
);
}