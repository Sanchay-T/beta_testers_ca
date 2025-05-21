import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const useRequireAuth = (redirectTo = '/login') => {
    const { user, loading, error } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            navigate(redirectTo, {
                state: {
                    from: window.location.hash.substring(1) || '/',
                    message: 'Please log in to access this page'
                },
                replace: true
            });
        }
    }, [user, loading, navigate, redirectTo]);

    return { user, loading, error };
};