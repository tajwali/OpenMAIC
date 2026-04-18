/**
 * Shared model resolution utilities for API routes.
 *
 * Extracts the repeated parseModelString → resolveApiKey → resolveBaseUrl →
 * resolveProxy → getModel boilerplate into a single call.
 */

import type { NextRequest } from 'next/server';
import { getModel, parseModelString, type ModelWithInfo } from '@/lib/ai/providers';
import { resolveApiKey, resolveBaseUrl, resolveProxy } from '@/lib/server/provider-config';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import type { ProviderId } from '@/lib/types/provider';
import { getPlatformSettings } from './platform-settings';

export interface ResolvedModel extends ModelWithInfo {
  /** Original model string (e.g. "google:gemini-2.0-flash") */
  modelString: string;
  /** Resolved provider ID */
  providerId: ProviderId;
  /** Effective API key after server-side fallback resolution */
  apiKey: string;
}

/**
 * Returns the full ordered model fallback chain.
 * Index 0 is the primary; subsequent entries are tried on overload/rate-limit.
 */
export async function getModelFallbackChain(): Promise<string[]> {
  const settings = await getPlatformSettings();
  
  const chain: string[] = [
    settings.DEFAULT_MODEL,
    'google:gemini-2.0-flash',
    'google:gemini-1.5-flash',
  ].filter((s): s is string => typeof s === 'string' && s.length > 0);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const m of chain) {
    if (!seen.has(m)) { seen.add(m); deduped.push(m); }
  }
  return deduped;
}

/**
 * Resolve a language model from explicit parameters.
 *
 * Use this when model config comes from the request body.
 */
export async function resolveModel(params: {
  modelString?: string;
  apiKey?: string;
  baseUrl?: string;
  providerType?: string;
  requiresApiKey?: boolean;
}): Promise<ResolvedModel> {
  let modelString = params.modelString;
  
  if (!modelString) {
    const settings = await getPlatformSettings();
    modelString = settings.DEFAULT_MODEL;
  }

  const { providerId, modelId } = parseModelString(modelString);

  // SSRF validation applies only to client-supplied base URLs.
  // Server-configured URLs (e.g. OLLAMA_BASE_URL from env/YAML) flow through
  // resolveBaseUrl() and bypass this check — they're trusted by the operator.
  const clientBaseUrl = params.baseUrl || undefined;
  if (clientBaseUrl && process.env.NODE_ENV === 'production') {
    const ssrfError = await validateUrlForSSRF(clientBaseUrl);
    if (ssrfError) {
      throw new Error(ssrfError);
    }
  }

  const apiKey = clientBaseUrl
    ? params.apiKey || ''
    : resolveApiKey(providerId, params.apiKey || '');
  const baseUrl = clientBaseUrl ? clientBaseUrl : resolveBaseUrl(providerId, params.baseUrl);
  const proxy = resolveProxy(providerId);
  const { model, modelInfo } = getModel({
    providerId,
    modelId,
    apiKey,
    baseUrl,
    proxy,
    providerType: params.providerType as 'openai' | 'anthropic' | 'google' | undefined,
  });

  return { model, modelInfo, modelString, apiKey, providerId };
}

/**
 * Resolve a language model from standard request headers.
 *
 * Reads: x-model, x-api-key, x-base-url, x-provider-type
 * Note: requiresApiKey is derived server-side from the provider registry,
 * never from client headers, to prevent auth bypass.
 */
export async function resolveModelFromHeaders(req: NextRequest): Promise<ResolvedModel> {
  return await resolveModel({
    modelString: req.headers.get('x-model') || undefined,
    apiKey: req.headers.get('x-api-key') || undefined,
    baseUrl: req.headers.get('x-base-url') || undefined,
    providerType: req.headers.get('x-provider-type') || undefined,
  });
}

/**
 * Pre-resolve all fallback models after the primary.
 * Returns resolved model objects ready to pass as `fallbackModels` to callLLM.
 * Silently skips any model that fails to resolve (e.g. missing API key).
 *
 * @param primaryModelString - The primary model string (to exclude from fallbacks)
 */
export async function resolveFallbackModels(primaryModelString: string): Promise<ResolvedModel['model'][]> {
  const fallbacks: ResolvedModel['model'][] = [];
  const chain = await getModelFallbackChain();
  
  for (const s of chain) {
    if (s === primaryModelString) continue;
    try {
      const resolved = await resolveModel({ modelString: s });
      fallbacks.push(resolved.model);
    } catch {
      // Skip models that fail to resolve
    }
  }
  
  return fallbacks;
}
