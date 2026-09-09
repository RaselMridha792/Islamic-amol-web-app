'use client';

export default function Avatar({ person, small = false }) {
  const letter = (person.name || '?').trim().charAt(0) || '?';
  return (
    <div className={'avatar' + (small ? ' sm' : '')}>
      {person.photo ? (
        <img src={person.photo} alt={person.name} />
      ) : (
        <span aria-hidden="true">{letter}</span>
      )}
    </div>
  );
}
