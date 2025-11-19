"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_KINDS = exports.SHORT_STATUSES = exports.JOB_STATUSES = exports.JOB_TYPES = exports.PROJECT_STATUSES = void 0;
exports.PROJECT_STATUSES = [
    'uploading',
    'ready',
    'queued',
    'processing',
    'transcribing',
    'analyzing',
    'rendering',
    'delivering',
    'completed',
    'error',
];
exports.JOB_TYPES = ['ingest', 'transcription', 'analysis', 'clip_render', 'delivery'];
exports.JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'canceled'];
exports.SHORT_STATUSES = ['pending', 'processing', 'completed', 'error'];
exports.ASSET_KINDS = ['source', 'transcript', 'clip', 'thumbnail', 'analysis'];
