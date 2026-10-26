import { NextRequest, NextResponse } from 'next/server'; 
 import { getCollection } from '@/lib/mongodb'; 
 import { auth } from '@/lib/auth'; 
 import { ObjectId } from 'mongodb'; 
 
 // GET — энэ бараа wishlist-д байгаа эсэхийг шалгах 
 export async function GET(req: NextRequest) { 
   try { 
     const { userId } = await auth(); 
     if (!userId) return NextResponse.json({ isWishlisted: false }); 
 
     const { searchParams } = new URL(req.url); 
     const productId = searchParams.get('productId'); 
     if (!productId) return NextResponse.json({ isWishlisted: false }); 
 
     const users = await getCollection('users'); 
     const user = await users.findOne({ _id: new ObjectId(userId) }); 
     const isWishlisted = (user?.wishlist || []).includes(productId); 
 
     return NextResponse.json({ isWishlisted }); 
   } catch { 
     return NextResponse.json({ isWishlisted: false }); 
   } 
 } 
 
 // POST — wishlist-д нэмэх 
 export async function POST(req: NextRequest) { 
   try { 
     const { userId } = await auth(); 
     if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); 
 
     const { productId } = await req.json(); 
     if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 }); 
 
     const users = await getCollection('users'); 
     await users.updateOne( 
       { _id: new ObjectId(userId) }, 
       { $addToSet: { wishlist: productId } } 
     ); 
 
     return NextResponse.json({ success: true }); 
   } catch { 
     return NextResponse.json({ error: 'Failed' }, { status: 500 }); 
   } 
 } 
 
 // DELETE — wishlist-аас хасах 
 export async function DELETE(req: NextRequest) { 
   try { 
     const { userId } = await auth(); 
     if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); 
 
     const { productId } = await req.json(); 
     if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 }); 
 
     const users = await getCollection('users'); 
     await users.updateOne( 
       { _id: new ObjectId(userId) }, 
       { $pull: { wishlist: productId } } 
     ); 
 
     return NextResponse.json({ success: true }); 
   } catch { 
     return NextResponse.json({ error: 'Failed' }, { status: 500 }); 
   } 
 }