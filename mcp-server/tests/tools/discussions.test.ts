import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../helpers.js';
import { createProject } from '../../src/tools/projects.js';
import { addTeamMember } from '../../src/tools/team-members.js';
import {
  createDiscussion, addDiscussionParticipant, addDiscussionMessage,
  updateDiscussionSummary, getDiscussion, listDiscussions
} from '../../src/tools/discussions.js';

describe('Discussions Tools', () => {
  let db: Database.Database;
  let projectId: string;
  let member1Id: string;
  let member2Id: string;

  beforeEach(() => {
    db = createTestDb();
    const project = createProject(db, { name: 'Test', description: 'Desc' });
    projectId = project.id;
    const m1 = addTeamMember(db, { project_id: projectId, role: 'project_manager' });
    member1Id = m1.id;
    const m2 = addTeamMember(db, { project_id: projectId, role: 'backend_developer' });
    member2Id = m2.id;
  });
  afterEach(() => { db.close(); });

  describe('create_discussion', () => {
    it('creates a discussion with participants', () => {
      const result = createDiscussion(db, {
        project_id: projectId, topic: 'API Design', created_by: member1Id, participant_ids: [member2Id]
      });
      expect(result.topic).toBe('API Design');
    });

    it('automatically adds creator as participant', () => {
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: []
      });
      const full = getDiscussion(db, { discussion_id: disc.id });
      expect(full.participants.length).toBe(1);
      expect(full.participants[0].member_id).toBe(member1Id);
    });
  });

  describe('add_discussion_participant', () => {
    it('adds a new participant after creation', () => {
      const member3 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: [member2Id]
      });
      addDiscussionParticipant(db, { discussion_id: disc.id, member_id: member3.id });
      const full = getDiscussion(db, { discussion_id: disc.id });
      expect(full.participants.length).toBe(3);
    });
  });

  describe('add_discussion_message', () => {
    it('adds a message from a participant', () => {
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: [member2Id]
      });
      const result = addDiscussionMessage(db, { discussion_id: disc.id, member_id: member1Id, content: 'Hello team' });
      expect(result.discussion_id).toBe(disc.id);
    });

    it('rejects message from non-participant', () => {
      const member3 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: [member2Id]
      });
      const result = addDiscussionMessage(db, { discussion_id: disc.id, member_id: member3.id, content: 'Hello' });
      expect(result.code).toBe('INVALID_INPUT');
    });
  });

  describe('update_discussion_summary', () => {
    it('sets the discussion summary', () => {
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'Test', created_by: member1Id, participant_ids: []
      });
      const result = updateDiscussionSummary(db, { discussion_id: disc.id, summary: 'We decided X' });
      expect(result.discussion_id).toBe(disc.id);
    });
  });

  describe('get_discussion', () => {
    it('returns full discussion with participants and messages', () => {
      const disc = createDiscussion(db, {
        project_id: projectId, topic: 'API Design', created_by: member1Id, participant_ids: [member2Id]
      });
      addDiscussionMessage(db, { discussion_id: disc.id, member_id: member1Id, content: 'Msg 1' });
      addDiscussionMessage(db, { discussion_id: disc.id, member_id: member2Id, content: 'Msg 2' });
      updateDiscussionSummary(db, { discussion_id: disc.id, summary: 'Summary' });

      const result = getDiscussion(db, { discussion_id: disc.id });
      expect(result.topic).toBe('API Design');
      expect(result.summary).toBe('Summary');
      expect(result.participants.length).toBe(2);
      expect(result.messages.length).toBe(2);
    });
  });

  describe('list_discussions', () => {
    it('filters by participant', () => {
      const member3 = addTeamMember(db, { project_id: projectId, role: 'qa_engineer' });
      createDiscussion(db, { project_id: projectId, topic: 'D1', created_by: member1Id, participant_ids: [member2Id] });
      createDiscussion(db, { project_id: projectId, topic: 'D2', created_by: member1Id, participant_ids: [member3.id] });

      const result = listDiscussions(db, { project_id: projectId, participant_id: member2Id });
      expect(result.length).toBe(1);
      expect(result[0].topic).toBe('D1');
    });
  });
});
