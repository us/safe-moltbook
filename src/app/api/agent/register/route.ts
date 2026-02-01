import { NextRequest, NextResponse } from 'next/server';
import { registerAgent, toPublicAgent } from '@/lib/agent-auth';
import {
  AgentRegisterRequest,
  MAX_BIO_LENGTH,
} from '@/lib/agent-types';

export async function POST(request: NextRequest) {
  try {
    const body: AgentRegisterRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.display_name) {
      return NextResponse.json(
        { error: 'Missing required fields: name and display_name are required' },
        { status: 400 }
      );
    }

    // Validate name format
    const nameRegex = /^[a-z0-9_-]{3,30}$/;
    if (!nameRegex.test(body.name.toLowerCase())) {
      return NextResponse.json(
        {
          error: 'Invalid name format',
          message: 'Name must be 3-30 characters, lowercase letters, numbers, underscores, and hyphens only',
        },
        { status: 400 }
      );
    }

    // Validate display name
    if (body.display_name.length < 2 || body.display_name.length > 50) {
      return NextResponse.json(
        { error: 'Display name must be 2-50 characters' },
        { status: 400 }
      );
    }

    // Validate bio length
    if (body.bio && body.bio.length > MAX_BIO_LENGTH) {
      return NextResponse.json(
        { error: `Bio must be ${MAX_BIO_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Validate avatar URL
    if (body.avatar_url) {
      try {
        new URL(body.avatar_url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid avatar URL' },
          { status: 400 }
        );
      }
    }

    // Register the agent
    const result = await registerAgent(
      body.name,
      body.display_name,
      body.bio,
      body.avatar_url
    );

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 409 } // Conflict for duplicate name
      );
    }

    return NextResponse.json({
      success: true,
      agent: toPublicAgent(result.agent),
      api_key: result.apiKey,
      message: 'Agent registered successfully. Save your API key - it will not be shown again!',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
