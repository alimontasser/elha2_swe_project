import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/labels.dart';
import '../../app/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../state/pantry.dart';

class _Message {
  const _Message.user(this.text) : reply = null;
  const _Message.assistant(AssistantReply this.reply) : text = '';

  final String text;
  final AssistantReply? reply;
  bool get fromUser => reply == null;
}

/// US-4.02: ask the cooking assistant what to make with the pantry. Answers are suggestions the
/// person reads and decides on (NFR-30); leftovers come with a reheating safety note (NFR-07).
class AssistantScreen extends ConsumerStatefulWidget {
  const AssistantScreen({super.key});

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <_Message>[];
  var _busy = false;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _ask(String question) async {
    final q = question.trim();
    if (q.isEmpty || _busy) return;
    final items = (ref.read(pantryProvider).value ?? const <PantryItem>[]).where((i) => i.status == ItemStatus.inStock).toList();
    setState(() {
      _messages.add(_Message.user(q));
      _busy = true;
      _input.clear();
    });
    _scrollToEnd();
    final reply = await ref.read(cookingAssistantProvider).ask(q, language: context.lang, items: items);
    if (!mounted) return;
    setState(() {
      _messages.add(_Message.assistant(reply));
      _busy = false;
    });
    _scrollToEnd();
  }

  void _scrollToEnd() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  });

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.assistantTitle)),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: Elha2Colors.greenSoft,
            padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 16, 8),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome_outlined, size: 16, color: Elha2Colors.green),
                const SizedBox(width: 8),
                Expanded(child: Text(l.assistantDisclaimer, style: const TextStyle(fontSize: 12, color: Elha2Colors.green))),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              key: const Key('assistantMessages'),
              controller: _scroll,
              padding: const EdgeInsets.all(16),
              children: [
                if (_messages.isEmpty) _Intro(onPick: _ask),
                for (final m in _messages) _Bubble(message: m),
                if (_busy) const _Thinking(),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      key: const Key('assistantInput'),
                      controller: _input,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 500,
                      textInputAction: TextInputAction.send,
                      onSubmitted: _ask,
                      decoration: InputDecoration(hintText: l.assistantHint, counterText: '', border: const OutlineInputBorder()),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    key: const Key('assistantSend'),
                    onPressed: _busy ? null : () => _ask(_input.text),
                    icon: const Icon(Icons.send),
                    label: Text(l.assistantSend),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Intro extends StatelessWidget {
  const _Intro({required this.onPick});

  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.soup_kitchen_outlined, color: Elha2Colors.green, size: 32),
            const SizedBox(width: 12),
            Expanded(child: Text(l.assistantIntro, style: Theme.of(context).textTheme.bodyLarge)),
          ],
        ),
        const SizedBox(height: 16),
        for (final s in [l.assistantSuggestion1, l.assistantSuggestion2, l.assistantSuggestion3])
          // A button, not an ActionChip: chips are announced as checkboxes on the web (NFR-17).
          Padding(
            padding: const EdgeInsetsDirectional.only(bottom: 8),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: OutlinedButton.icon(
                onPressed: () => onPick(s),
                icon: const Icon(Icons.lightbulb_outline, size: 18),
                label: Text(s, textAlign: TextAlign.start),
              ),
            ),
          ),
      ],
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final _Message message;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final mine = message.fromUser;
    final reply = message.reply;
    final width = MediaQuery.sizeOf(context).width * 0.82;
    return Align(
      alignment: mine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: Semantics(
        label: mine ? l.assistantYou : l.assistantBot,
        child: Container(
          constraints: BoxConstraints(maxWidth: width),
          margin: const EdgeInsetsDirectional.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: mine ? Elha2Colors.green : Colors.white,
            border: mine ? null : Border.all(color: const Color(0xFFDCE3DE)),
            borderRadius: BorderRadiusDirectional.only(
              topStart: const Radius.circular(16),
              topEnd: const Radius.circular(16),
              bottomStart: Radius.circular(mine ? 16 : 4),
              bottomEnd: Radius.circular(mine ? 4 : 16),
            ),
          ),
          child: mine
              ? Text(message.text, style: const TextStyle(color: Colors.white))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(reply!.unreachable ? l.assistantUnreachable : reply.answer),
                    if (reply.reheatingNote.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Container(
                        key: const Key('assistantSafetyNote'),
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: Elha2Colors.orangeSoft, borderRadius: BorderRadius.circular(8)),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.health_and_safety_outlined, size: 18, color: Elha2Colors.orange),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(text: '${l.assistantSafetyNote}: ', style: const TextStyle(fontWeight: FontWeight.bold)),
                                    TextSpan(text: reply.reheatingNote),
                                  ],
                                ),
                                style: const TextStyle(color: Elha2Colors.orange, fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (reply.usedItems.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        l.assistantUses(reply.usedItems.join(context.lang == 'ar' ? '، ' : ', ')),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    if (reply.fallbackUsed && !reply.unreachable) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.cloud_off, size: 14),
                          const SizedBox(width: 4),
                          Expanded(child: Text(l.assistantOffline, style: Theme.of(context).textTheme.bodySmall)),
                        ],
                      ),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}

class _Thinking extends StatelessWidget {
  const _Thinking();

  @override
  Widget build(BuildContext context) => Align(
    alignment: AlignmentDirectional.centerStart,
    child: Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 12),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: 8),
          Text(context.l10n.assistantThinking),
        ],
      ),
    ),
  );
}
