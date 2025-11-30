import React from 'react';

const ChoiceModal = ({ onRestart, onDuel }) => {
  return (
    <div className="choice-modal">
      <h2>Выберите дальнейшее действие</h2>
      <div className="buttons">
        <button onClick={onRestart} className="btn restart-btn">Пройти заново</button>
        <button onClick={onDuel} className="btn duel-btn">Перейти к батлу</button>
      </div>
    </div>
  );
};

export default ChoiceModal;