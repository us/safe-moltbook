import { NextResponse } from 'next/server';
import { getSubmolts } from '@/lib/posts';

export async function GET() {
  const submolts = await getSubmolts();

  return NextResponse.json({
    submolts,
  });
}
