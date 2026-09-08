import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const correctPassword = process.env.SCREEN_PASSWORD || '1234';

    if (password && String(password).trim() === correctPassword.trim()) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, message: '비밀번호가 일치하지 않습니다.' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: '인증 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
