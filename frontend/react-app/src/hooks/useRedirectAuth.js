import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const useAuthRedirect = (redirectTo = '/') => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading && user) {
            const intendedPath = location.state?.from || redirectTo;
            navigate(intendedPath, { replace: true });
        }
    }, [user, loading, navigate, location, redirectTo]);

    return { loading };
};