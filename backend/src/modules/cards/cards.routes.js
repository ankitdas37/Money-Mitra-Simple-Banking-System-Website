const express = require('express');
const router = express.Router();
const { getCards, createCard, toggleFreeze, updateLimit, revealCard, updateSettings, permanentBlock, deleteCard } = require('./cards.controller');
const { authenticate } = require('../../middleware/auth');

router.use(authenticate);
router.get('/', getCards);
router.post('/', createCard);
router.get('/:id/reveal', revealCard);
router.put('/:id/freeze', toggleFreeze);
router.put('/:id/limit', updateLimit);
router.put('/:id/settings', updateSettings);
router.put('/:id/block', permanentBlock);
router.delete('/:id', deleteCard);

module.exports = router;
